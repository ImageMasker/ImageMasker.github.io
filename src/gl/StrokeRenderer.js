// Brush strokes, eraser strokes and stamps drawn on the GPU, straight into a render target at
// whatever scale is being rendered. The geometry (raster/strokes.js) is in document pixels, so
// the preview and the full-size export draw the same shapes and nothing has to be kept between
// them; only a small vertex buffer per layer stays on the GPU.
//
// Each line piece is a quad around a capsule (round ends; the marker's first and last ends are
// square) whose edge is smoothed in the fragment shader, so strokes stay sharp at any zoom. Strokes at full opacity are
// drawn in batches; a see-through stroke is first drawn on its own into a scratch target (keeping
// the strongest coverage where its pieces overlap) and then laid down once, like Canvas 2D does,
// so it doesn't get darker where it crosses itself.

import { hexToVec3 } from './effects.js';
import { strokeGeometry } from '../raster/strokes.js';

// x0, y0, x1, y1, radius, square ends, r, g, b
const PIECE_FLOATS = 9;
const STAMP_FLOATS = 4;

const PIECE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aPiece;
layout(location = 2) in vec2 aShape;
layout(location = 3) in vec3 aColor;
uniform vec2 uDocSize;
uniform float uScale;
out vec2 vLocal;
out vec4 vShape;
out vec3 vColor;
void main() {
  vec2 a = aPiece.xy;
  vec2 d = aPiece.zw - a;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  // Hairlines are drawn half a pixel wide and fainter, so they don't vanish between pixels.
  float radius = max(aShape.x, 0.5 / uScale);
  float reach = radius * (aShape.y > 0.5 ? 1.4143 : 1.0) + 1.5 / uScale;
  vec2 local = vec2(aCorner.x < 0.0 ? -reach : len + reach, aCorner.y * reach);
  vec2 p = a + dir * local.x + vec2(-dir.y, dir.x) * local.y;
  vLocal = local;
  vShape = vec4(len, radius, aShape.y, aShape.x / radius);
  vColor = aColor;
  gl_Position = vec4(p / uDocSize * 2.0 - 1.0, 0.0, 1.0);
}`;

// vShape: length, radius, square ends (1 start, 2 end), hairline fade. Joins are round.
const PIECE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec4 vShape;
in vec3 vColor;
uniform float uScale;
uniform int uCoverage;
out vec4 outColor;
void main() {
  float len = vShape.x;
  float radius = vShape.y;
  float side = abs(vLocal.y);
  float beyond = vLocal.x < 0.0 ? -vLocal.x : max(vLocal.x - len, 0.0);
  int ends = int(vShape.z + 0.5);
  bool square = vLocal.x < 0.0 ? (ends == 1 || ends == 3) : (vLocal.x > len && ends >= 2);
  float dist;
  if (square) {
    vec2 q = vec2(beyond, side) - radius;
    dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  } else {
    dist = length(vec2(beyond, side)) - radius;
  }
  float cov = clamp(0.5 - dist * uScale, 0.0, 1.0) * vShape.w;
  if (cov <= 0.0) discard;
  outColor = uCoverage == 1 ? vec4(cov) : vec4(vColor * cov, cov);
}`;

const STAMP_VERTEX = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aStamp;
uniform vec2 uDocSize;
out vec2 vUv;
void main() {
  float c = cos(aStamp.w);
  float s = sin(aStamp.w);
  // The emoji fills half the texture's side (stamp size = half the quad's).
  vec2 o = aCorner * aStamp.z;
  vec2 p = aStamp.xy + vec2(c * o.x - s * o.y, s * o.x + c * o.y);
  vUv = aCorner * 0.5 + 0.5;
  gl_Position = vec4(p / uDocSize * 2.0 - 1.0, 0.0, 1.0);
}`;

const STAMP_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uOpacity;
out vec4 outColor;
void main() {
  outColor = texture(uTex, vUv) * uOpacity;
}`;

// Lays a see-through stroke's coverage (drawn into the scratch target) onto the layer.
const LAY_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCov;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  outColor = uColor * texture(uCov, vUv).a;
}`;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export class StrokeRenderer {
  constructor(glx) {
    this.glx = glx;
    this.vaos = null;
    glx.onRestore(() => {
      this.vaos = null;
    });
  }

  /** Two vertex arrays sharing one quad: line pieces and stamps (instance buffers are bound per draw). */
  setup() {
    const gl = this.glx.gl;
    const quad = gl.createBuffer();
    const make = () => {
      const vao = gl.createVertexArray();

      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      return vao;
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vaos = { pieces: make(), stamps: make() };
    gl.bindVertexArray(null);
  }

  /**
   * Brings `item` (a compositor cache entry for one stroke list) up to date with `strokes`: the
   * shapes of every stroke in two vertex buffers, and the list of draws. Only the strokes from the
   * first one that changed are written again, so drawing a stroke doesn't re-send the others.
   */
  prepare(item, strokes) {
    if (item.strokes === strokes) {
      return item.batch;
    }

    const gl = this.glx.gl;
    const old = item.batch;
    let keep = 0;

    if (old) {
      while (keep < old.entries.length && keep < strokes.length && old.entries[keep].stroke === strokes[keep]) {
        keep += 1;
      }
    }

    const entries = old ? old.entries.slice(0, keep) : [];
    let pieceCount = keep ? entries[keep - 1].pieceFirst + entries[keep - 1].pieceCount : 0;
    let stampCount = keep ? entries[keep - 1].stampFirst + entries[keep - 1].stampCount : 0;
    const firstPiece = pieceCount;
    const firstStamp = stampCount;
    const fresh = strokes.slice(keep).map((stroke) => ({ stroke, geometry: strokeGeometry(stroke) }));
    const needPieces = pieceCount + fresh.reduce((sum, entry) => sum + entry.geometry.pieces.length / 6, 0);
    const needStamps = stampCount + fresh.reduce((sum, entry) => sum + entry.geometry.stamps.length / 4, 0);
    const grow = (array, floats) => {
      if (array && array.length >= floats) {
        return array;
      }

      const next = new Float32Array(Math.max(floats, (array?.length ?? 0) * 2, 1024));

      if (array) {
        next.set(array.subarray(0, Math.min(array.length, next.length)));
      }

      return next;
    };
    const pieces = grow(old?.pieces, needPieces * PIECE_FLOATS);
    const stamps = grow(old?.stamps, needStamps * STAMP_FLOATS);

    for (const { stroke, geometry } of fresh) {
      const [r, g, b] = stroke.tool === 'brush' ? hexToVec3(stroke.color || '#000000') : [0, 0, 0];
      const source = geometry.pieces;
      const entry = {
        stroke,
        bounds: geometry.bounds,
        pieceFirst: pieceCount,
        pieceCount: source.length / 6,
        stampFirst: stampCount,
        stampCount: geometry.stamps.length / 4,
      };

      for (let i = 0; i < source.length; i += 6) {
        const at = pieceCount * PIECE_FLOATS;

        pieces.set(source.subarray(i, i + 6), at);
        pieces[at + 6] = r;
        pieces[at + 7] = g;
        pieces[at + 8] = b;
        pieceCount += 1;
      }

      stamps.set(geometry.stamps, stampCount * STAMP_FLOATS);
      stampCount += entry.stampCount;
      entries.push(entry);
    }

    const upload = (buffer, array, grown, first, count, floats) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

      if (grown) {
        gl.bufferData(gl.ARRAY_BUFFER, array, gl.DYNAMIC_DRAW);
      } else if (count > first) {
        gl.bufferSubData(gl.ARRAY_BUFFER, first * floats * 4, array, first * floats, (count - first) * floats);
      }
    };
    const pieceBuffer = old?.pieceBuffer ?? gl.createBuffer();
    const stampBuffer = old?.stampBuffer ?? gl.createBuffer();

    upload(pieceBuffer, pieces, pieces !== old?.pieces, firstPiece, pieceCount, PIECE_FLOATS);
    upload(stampBuffer, stamps, stamps !== old?.stamps, firstStamp, stampCount, STAMP_FLOATS);

    item.strokes = strokes;
    item.batch = { entries, pieces, stamps, pieceBuffer, stampBuffer, draws: this.plan(entries) };
    item.dispose ??= () => {
      gl.deleteBuffer(item.batch?.pieceBuffer ?? null);
      gl.deleteBuffer(item.batch?.stampBuffer ?? null);
    };
    return item.batch;
  }

  /** Groups strokes into draws: runs of opaque pieces, see-through strokes on their own, stamps. */
  plan(entries) {
    const draws = [];

    for (const { stroke, bounds, pieceFirst, pieceCount, stampFirst, stampCount } of entries) {
      const opacity = clamp01(stroke.opacity ?? 1);

      if (!(opacity > 0) || !bounds) {
        continue;
      }

      if (stroke.tool === 'stamp') {
        draws.push({ kind: 'stamp', first: stampFirst, count: stampCount, opacity, emoji: String(stroke.emoji || '🙂').slice(0, 40), style: stroke.style ?? 0 });
        continue;
      }

      const erase = stroke.tool === 'eraser';
      const last = draws[draws.length - 1];

      if (opacity < 1) {
        const [r, g, b] = erase ? [0, 0, 0] : hexToVec3(stroke.color || '#000000');

        draws.push({ kind: 'alone', erase, first: pieceFirst, count: pieceCount, bounds, color: [r * opacity, g * opacity, b * opacity, opacity] });
      } else if (last?.kind === 'run' && last.erase === erase && last.first + last.count === pieceFirst) {
        last.count += pieceCount;
      } else {
        draws.push({ kind: 'run', erase, first: pieceFirst, count: pieceCount });
      }
    }

    return draws;
  }

  /**
   * Draws `strokes` into a new pooled target the size of the render (doc space, row 0 = top);
   * release it when done. `stampTexture(emoji, style, px)` gives the texture for a stamp drawn
   * about `px` render pixels across.
   */
  render(item, strokes, ctx, stampTexture) {
    const glx = this.glx;
    const gl = glx.gl;
    const batch = this.prepare(item, strokes);
    const target = glx.acquire(ctx.W, ctx.H);
    const scale = ctx.W / ctx.doc.width;
    const pieceProgram = glx.program('strokes:piece', PIECE_FRAGMENT, PIECE_VERTEX);
    const stampProgram = glx.program('strokes:stamp', STAMP_FRAGMENT, STAMP_VERTEX);
    let scratch = null;

    if (!this.vaos) {
      this.setup();
    }

    glx.clear(target);
    gl.enable(gl.BLEND);

    const blend = (erase) => (erase ? gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA) : gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA));
    const drawPieces = (into, first, count, coverage) => {
      glx.use(pieceProgram, into, { uDocSize: ctx.docSize, uScale: scale, uCoverage: coverage });
      gl.bindVertexArray(this.vaos.pieces);
      gl.bindBuffer(gl.ARRAY_BUFFER, batch.pieceBuffer);

      const stride = PIECE_FLOATS * 4;
      const base = first * stride;

      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, base);
      gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, base + 16);
      gl.vertexAttribDivisor(2, 1);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, base + 24);
      gl.vertexAttribDivisor(3, 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    };

    for (const draw of batch.draws) {
      if (draw.kind === 'run') {
        blend(draw.erase);
        drawPieces(target, draw.first, draw.count, 0);
      } else if (draw.kind === 'alone') {
        // Only the stroke's own box is cleared and laid down.
        const [x0, y0, x1, y1] = draw.bounds;
        const left = Math.max(0, Math.floor(x0 * scale) - 2);
        const top = Math.max(0, Math.floor(y0 * scale) - 2);
        const right = Math.min(ctx.W, Math.ceil(x1 * scale) + 2);
        const bottom = Math.min(ctx.H, Math.ceil(y1 * scale) + 2);

        if (right <= left || bottom <= top) {
          continue;
        }

        scratch ??= glx.acquire(ctx.W, ctx.H);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(left, top, right - left, bottom - top);
        glx.clear(scratch);
        gl.blendEquation(gl.MAX);
        gl.blendFunc(gl.ONE, gl.ONE);
        drawPieces(scratch, draw.first, draw.count, 1);
        gl.blendEquation(gl.FUNC_ADD);
        blend(draw.erase);
        glx.draw(glx.program('strokes:lay', LAY_FRAGMENT), target, { uCov: scratch, uColor: draw.color });
        gl.disable(gl.SCISSOR_TEST);
      } else {
        const sizePx = batch.stamps[draw.first * STAMP_FLOATS + 2] * scale;
        blend(false);
        glx.use(stampProgram, target, { uDocSize: ctx.docSize, uTex: stampTexture(draw.emoji, draw.style, sizePx), uOpacity: draw.opacity });
        gl.bindVertexArray(this.vaos.stamps);
        gl.bindBuffer(gl.ARRAY_BUFFER, batch.stampBuffer);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, STAMP_FLOATS * 4, draw.first * STAMP_FLOATS * 4);
        gl.vertexAttribDivisor(1, 1);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, draw.count);
      }
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    glx.release(scratch);
    return target;
  }
}
