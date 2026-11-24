// Turns a document into pixels. Layers are folded bottom-to-top into an accumulator texture:
// content layers (images, overlay masks, text, shapes, drawings) are blended over it, effect
// layers re-process whatever is already there. The same code renders the preview and the export,
// only the scale differs.

import { apply, invert, layerMatrix, toMat3 } from '../core/geometry.js';
import { emojiSignature, renderEmojiTile } from '../raster/emoji.js';
import { renderRepeatTile, repeatSignature } from '../raster/repeat.js';
import { drawEmoji, emojiArtState } from '../raster/emojiArt.js';
import { markRatio, markSignature, renderMark } from '../raster/shapes.js';
import { measureText, renderText, textSignature } from '../raster/text.js';
import { effectShader, getEffect, hexToVec3, paramUniforms } from './effects.js';
import {
  BLUR_SHADER,
  COPY_SHADER,
  LAYER_SOLID,
  LAYER_TEXTURE,
  MIX_SHADER,
  PRESENT_SHADER,
  TRANSFORM_SHADER,
  blendIndex,
  layerShader,
} from './glsl.js';
import { getPattern, patternSource, patternUniforms } from './patterns.js';
import { StrokeRenderer } from './StrokeRenderer.js';

const NONE = [0, 0, 0, 0];
const COVERAGE_KIND = { full: 0, rect: 1, ellipse: 2, polygon: 3, paint: 4 };

export class Compositor {
  constructor(glx, assets) {
    this.glx = glx;
    this.assets = assets;
    this.textures = new Map();
    this.cache = new Map();
    this.frame = 0;
    this.strokes = new StrokeRenderer(glx);

    glx.onRestore(() => {
      this.textures.clear();
      this.cache.clear();
    });
  }

  // ── programs ──────────────────────────────────────────────────────────────

  textureProgram() {
    return this.glx.program('layer:texture', () => layerShader(LAYER_TEXTURE));
  }

  solidProgram() {
    return this.glx.program('layer:solid', () => layerShader(LAYER_SOLID));
  }

  patternProgram(definition) {
    return this.glx.program(`pattern:${definition.id}`, () => layerShader(patternSource(definition)));
  }

  effectProgram(definition) {
    return this.glx.program(`effect:${definition.shader ?? definition.id}`, () => effectShader(definition));
  }

  // ── textures ──────────────────────────────────────────────────────────────

  assetTexture(assetId) {
    const asset = this.assets.get(assetId);

    if (!asset) {
      return null;
    }

    let entry = this.textures.get(assetId);

    if (!entry) {
      const gl = this.glx.gl;

      entry = this.glx.textureFromSource(asset.source);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      this.textures.set(assetId, entry);
    }

    return entry;
  }

  cached(key) {
    let item = this.cache.get(key);

    if (!item) {
      item = { entry: null, sig: null };
      this.cache.set(key, item);
    }

    item.used = this.frame;
    return item;
  }

  upload(item, canvas) {
    if (item.entry) {
      this.glx.updateTexture(item.entry, canvas);
    } else {
      item.entry = this.glx.textureFromSource(canvas);
    }
  }

  /**
   * A stroke list drawn at this render's size, in document space; `field` is 'strokes' or
   * 'erased'. Returns a pooled target: release it once it has been used.
   */
  strokeTarget(ctx, layer, field = 'strokes') {
    return this.strokes.render(this.cached(`${layer.id}:${field}`), layer[field], ctx, (emoji, style, px) => this.stampTexture(emoji, style, px));
  }

  /**
   * An emoji for the stamps at about the size it is shown, so it stays sharp in an export. It is
   * drawn with drawEmoji at half the texture's side, centred, so emojis from the device's font
   * that run a little wide still fit.
   */
  stampTexture(emoji, style, px) {
    const side = Math.min(2048, Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(1, px * 2)))));
    const sig = emojiArtState([emoji], style);
    const item = this.cached(`stamp:${style}:${emoji}:${side}`);

    if (item.sig !== sig) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const gl = this.glx.gl;

      canvas.width = canvas.height = side;
      context.translate(side / 2, side / 2);
      drawEmoji(context, emoji, side / 2, style);
      this.upload(item, canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      item.sig = sig;
    }

    return item.entry;
  }

  textTexture(ctx, layer) {
    const natural = measureText(layer);
    const wanted = ctx.sx * Math.max(layer.sx || 1, layer.sy || 1);
    const ratio = Math.max(0.05, Math.min(wanted, 4096 / Math.max(natural.width, natural.height)));
    const sig = `${textSignature(layer)}@${ratio.toFixed(3)}`;
    const item = this.cached(`${layer.id}:text`);

    if (item.sig !== sig) {
      this.upload(item, renderText(layer, ratio));
      item.sig = sig;
    }

    return item.entry;
  }

  /** A shape or arrow, drawn at about the size it is shown (raster/shapes.js). */
  markTexture(ctx, layer) {
    const ratio = markRatio(layer, ctx.sx);
    const sig = `${markSignature(layer)}@${ratio.toFixed(3)}`;
    const item = this.cached(`${layer.id}:mark`);

    if (item.sig !== sig) {
      this.upload(item, renderMark(layer, ratio));
      item.sig = sig;
    }

    return item.entry;
  }

  /** One tile of an emoji mask, at about the resolution the layer's box is drawn at. */
  emojiTexture(ctx, layer, boxPx) {
    const size = Math.max(128, Math.min(4096, Math.ceil(Math.max(boxPx[0], boxPx[1]) / 128) * 128));
    const sig = `${emojiSignature(layer)}@${size}`;
    const item = this.cached(`${layer.id}:emoji`);

    if (item.sig !== sig) {
      this.upload(item, renderEmojiTile(layer, size));
      item.sig = sig;
    }

    return item.entry;
  }

  /** An image mask drawn as a repeated pattern (raster/repeat.js), one tile per layer box. */
  repeatTexture(ctx, layer, boxPx) {
    const asset = this.assets.get(layer.assetId);

    if (!asset) {
      return null;
    }

    const fit = Math.min(1, 4096 / Math.max(boxPx[0], boxPx[1], 1));
    const width = Math.max(64, Math.ceil((boxPx[0] * fit) / 64) * 64);
    const height = Math.max(64, Math.ceil((boxPx[1] * fit) / 64) * 64);
    const sig = `${layer.assetId}|${repeatSignature(layer.repeat)}@${width}x${height}`;
    const item = this.cached(`${layer.id}:repeat`);

    if (item.sig !== sig) {
      this.upload(item, renderRepeatTile(asset.source, layer.repeat, width, height));
      item.sig = sig;
    }

    return item.entry;
  }

  polygonTexture(ctx, layer) {
    const width = Math.max(8, Math.min(2048, Math.ceil(layer.w * ctx.sx)));
    const height = Math.max(8, Math.min(2048, Math.ceil(layer.h * ctx.sy)));
    const feather = Math.round((layer.feather || 0) * 0.005 * Math.min(width, height));
    const item = this.cached(`${layer.id}:polygon`);

    if (item.points !== layer.points || item.sig !== `${width}x${height}:${feather}`) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const points = layer.points ?? [];

      canvas.width = width;
      canvas.height = height;

      if (feather > 0 && 'filter' in context) {
        context.filter = `blur(${feather}px)`;
      }

      context.beginPath();

      for (let index = 0; index < points.length; index += 2) {
        const x = (points[index] + 0.5) * width;
        const y = (points[index + 1] + 0.5) * height;

        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.closePath();
      context.fillStyle = '#ffffff';
      context.fill();
      this.upload(item, canvas);
      item.points = layer.points;
      item.sig = `${width}x${height}:${feather}`;
    }

    return item.entry;
  }

  /** Coverage of a layer's collage piece, in document space (row 0 = top). */
  clipTexture(ctx, layer) {
    const fit = Math.min(1, 2048 / Math.max(ctx.W, ctx.H));
    const width = Math.max(8, Math.round(ctx.W * fit));
    const height = Math.max(8, Math.round(ctx.H * fit));
    const item = this.cached(`${layer.id}:clip`);
    const points = layer.clip.points;

    if (item.points !== points || item.sig !== `${width}x${height}`) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const kx = width / ctx.doc.width;
      const ky = height / ctx.doc.height;

      canvas.width = width;
      canvas.height = height;
      context.beginPath();

      for (let index = 0; index < points.length; index += 2) {
        context[index === 0 ? 'moveTo' : 'lineTo'](points[index] * kx, points[index + 1] * ky);
      }

      context.closePath();
      context.fillStyle = '#ffffff';
      context.fill();
      this.upload(item, canvas);
      item.points = points;
      item.sig = `${width}x${height}`;
    }

    return item.entry;
  }

  /** Keeps `next` (acc with the layer applied) only inside the layer's collage piece. */
  clipTo(ctx, acc, next, layer) {
    return this.keepInside(ctx, acc, next, this.clipTexture(ctx, layer));
  }

  /** Keeps `next` only where `coverage` (a doc-space texture) is opaque; `acc` elsewhere. */
  keepInside(ctx, acc, next, coverage) {
    const out = this.glx.acquire(ctx.W, ctx.H);

    this.glx.draw(this.glx.program('mix', MIX_SHADER), out, {
      uDst: acc,
      uSrc: next,
      uCov: coverage,
      uDocSize: ctx.docSize,
      uInv: ctx.docInv,
      uBoxPx: [ctx.W, ctx.H],
      uKind: 4,
      uFeather: 0,
      uOpacity: 1,
      uBlend: 0,
    });
    this.glx.release(next);
    return out;
  }

  /**
   * Takes the layer back out where it was erased with the "Erase selected layer" eraser: inside
   * the erased area the result is what was below the layer (`acc`), elsewhere `next`.
   */
  eraseFrom(ctx, acc, next, layer) {
    const out = this.glx.acquire(ctx.W, ctx.H);
    const erased = this.strokeTarget(ctx, layer, 'erased');

    this.glx.draw(this.glx.program('mix', MIX_SHADER), out, {
      uDst: next,
      uSrc: acc,
      uCov: erased,
      uDocSize: ctx.docSize,
      uInv: ctx.docInv,
      uBoxPx: [ctx.W, ctx.H],
      uKind: 4,
      uFeather: 0,
      uOpacity: 1,
      uBlend: 0,
    });
    this.glx.release(erased);
    this.glx.release(next);
    return out;
  }

  /**
   * The layer a "clip to the layer below" layer is limited to: the nearest layer under it that is
   * not clipped itself (so several clipped layers stack on one, like clipping masks elsewhere).
   * Null when there is nothing to clip to (or it is an effect, which has no shape of its own).
   */
  clipBase(layers, index) {
    for (let below = index - 1; below >= 0; below -= 1) {
      if (!layers[below].clipBelow) {
        return layers[below].type === 'effect' ? null : layers[below];
      }
    }

    return null;
  }

  /** The shape of a content layer on its own (its alpha), rendered once per frame. */
  layerShape(ctx, layer) {
    ctx.shapes ??= new Map();

    let shape = ctx.shapes.get(layer.id);

    if (!shape) {
      const glx = this.glx;
      const empty = glx.acquire(ctx.W, ctx.H);

      glx.clear(empty);
      shape = this.drawContent(ctx, empty, { ...layer, opacity: 1, blend: 'normal' });

      if (shape !== empty && layer.clip?.points?.length >= 6) {
        shape = this.clipTo(ctx, empty, shape, layer);
      }

      if (shape !== empty && layer.erased?.length) {
        shape = this.eraseFrom(ctx, empty, shape, layer);
      }

      if (shape !== empty) {
        glx.release(empty);
      }

      ctx.shapes.set(layer.id, shape);
    }

    return shape;
  }

  /** Drops rasters that were not needed by the most recent frames (old scales, deleted layers). */
  prune() {
    for (const [key, item] of this.cache) {
      if (item.used < this.frame - 2) {
        item.dispose?.();
        this.glx.deleteTexture(item.entry);
        this.cache.delete(key);
      }
    }
  }

  // ── rendering ─────────────────────────────────────────────────────────────

  /**
   * Renders the document at `scale` and returns a pooled render target (release it when done).
   * `only` / `hidden` are optional Sets of layer ids.
   */
  render(doc, { scale = 1, only = null, hidden = null } = {}) {
    const glx = this.glx;
    const W = Math.max(1, Math.round(doc.width * scale));
    const H = Math.max(1, Math.round(doc.height * scale));
    const unit = Math.min(doc.width, doc.height);
    const ctx = {
      doc,
      base: null,
      W,
      H,
      unit,
      sx: W / doc.width,
      sy: H / doc.height,
      docSize: [doc.width, doc.height],
      docInv: [1 / doc.width, 0, 0, 0, 1 / doc.height, 0, -0.5, -0.5, 1],
      asp: [doc.width / unit, doc.height / unit],
      px: 1 / (unit * Math.min(W / doc.width, H / doc.height)),
    };

    this.frame += 1;

    let acc = glx.acquire(W, H);
    glx.clear(acc);

    for (const [index, layer] of doc.layers.entries()) {
      if (!layer.visible || !(layer.opacity > 0) || (only && !only.has(layer.id)) || hidden?.has(layer.id)) {
        continue;
      }

      const clipBase = layer.clipBelow ? this.clipBase(doc.layers, index) : null;

      // Clipped to a hidden layer: nothing to show it on.
      if (clipBase && (!clipBase.visible || hidden?.has(clipBase.id))) {
        continue;
      }

      let next = layer.type === 'effect' ? this.drawEffect(ctx, acc, layer) : this.drawContent(ctx, acc, layer);

      if (next !== acc && layer.clip?.points?.length >= 6) {
        next = this.clipTo(ctx, acc, next, layer);
      }

      if (next !== acc && layer.erased?.length) {
        next = this.eraseFrom(ctx, acc, next, layer);
      }

      if (next !== acc && clipBase && !clipBase.base) {
        next = this.keepInside(ctx, acc, next, this.layerShape(ctx, clipBase));
      }

      if (next !== acc) {
        glx.release(acc);
        acc = next;
      }
    }

    glx.release(ctx.base);

    for (const shape of ctx.shapes?.values() ?? []) {
      glx.release(shape);
    }

    return acc;
  }

  /** The base picture on its own, rendered once per frame for "reveal original" layers. */
  baseTarget(ctx) {
    if (!ctx.base) {
      const glx = this.glx;
      let acc = glx.acquire(ctx.W, ctx.H);

      glx.clear(acc);

      for (const layer of ctx.doc.layers) {
        if (layer.type === 'image' && layer.base) {
          const next = this.drawContent(ctx, acc, { ...layer, opacity: 1, blend: 'normal' });

          if (next !== acc) {
            glx.release(acc);
            acc = next;
          }
        }
      }

      ctx.base = acc;
    }

    return ctx.base;
  }

  contentSpec(ctx, layer) {
    const boxPx = [layer.w * ctx.sx, layer.h * ctx.sy];
    const uInv = toMat3(invert(layerMatrix(layer)));

    switch (layer.type) {
      case 'image': {
        const uSrc = this.assetTexture(layer.assetId);

        return uSrc && {
          program: this.textureProgram(),
          uniforms: { uSrc, uWrap: 0, uInv, uBoxPx: boxPx, uFx: [0, 0, 0, 1], uWarp: NONE },
        };
      }
      case 'mask': {
        const uFx = [((layer.hue || 0) * Math.PI) / 180, layer.invert ? 1 : 0, (layer.noise || 0) * 0.006, 0];
        const uWarp = [(layer.warp || 0) * 0.0012, 7, layer.warpSeed ?? 0.5, 0];

        if (layer.source === 'pattern') {
          const definition = getPattern(layer.patternId);
          const density = Number(layer.params?.density) || 10;

          return {
            program: this.patternProgram(definition),
            uniforms: {
              ...patternUniforms(definition, layer.params),
              uPatScale: [(density * layer.w) / layer.h, density],
              uAA: density / Math.max(1, boxPx[1]),
              uSeed: layer.seed || 0,
              uInv,
              uBoxPx: boxPx,
              uFx,
              uWarp,
            },
          };
        }

        if (layer.source === 'emoji') {
          // The tile repeats seamlessly, so the layer always covers the whole picture.
          return {
            program: this.textureProgram(),
            uniforms: { uSrc: this.emojiTexture(ctx, layer, boxPx), uWrap: 1, uInv, uBoxPx: boxPx, uFx, uWarp },
          };
        }

        if (layer.repeat) {
          const uSrc = this.repeatTexture(ctx, layer, boxPx);

          return uSrc && { program: this.textureProgram(), uniforms: { uSrc, uWrap: 1, uInv, uBoxPx: boxPx, uFx, uWarp } };
        }

        const uSrc = this.assetTexture(layer.assetId);

        uFx[3] = layer.tile ? 0 : 1;
        return uSrc && {
          program: this.textureProgram(),
          uniforms: { uSrc, uWrap: layer.tile ? 1 : 0, uInv, uBoxPx: boxPx, uFx, uWarp },
        };
      }
      case 'rect': {
        const [r, g, b] = hexToVec3(layer.color);

        return {
          program: this.solidProgram(),
          uniforms: {
            uColor: [r, g, b, 1],
            uCorner: Math.min((layer.corner || 0) * ctx.sx, Math.min(boxPx[0], boxPx[1]) / 2),
            uInv,
            uBoxPx: boxPx,
            uFx: NONE,
            uWarp: NONE,
          },
        };
      }
      case 'text':
        return {
          program: this.textureProgram(),
          uniforms: { uSrc: this.textTexture(ctx, layer), uWrap: 0, uInv, uBoxPx: boxPx, uFx: [0, 0, 0, 1], uWarp: NONE },
        };
      case 'shape':
      case 'arrow':
        return {
          program: this.textureProgram(),
          uniforms: { uSrc: this.markTexture(ctx, layer), uWrap: 0, uInv, uBoxPx: boxPx, uFx: [0, 0, 0, 1], uWarp: NONE },
        };
      case 'drawing': {
        if (!layer.strokes?.length) {
          return null;
        }

        const strokes = this.strokeTarget(ctx, layer);

        return {
          program: this.textureProgram(),
          temp: strokes,
          uniforms: { uSrc: strokes, uWrap: 0, uInv: ctx.docInv, uBoxPx: [ctx.W, ctx.H], uFx: NONE, uWarp: NONE },
        };
      }
      default:
        return null;
    }
  }

  drawContent(ctx, acc, layer) {
    const spec = this.contentSpec(ctx, layer);

    if (!spec) {
      return acc;
    }

    const glx = this.glx;
    const out = glx.acquire(ctx.W, ctx.H);
    const common = {
      uDocSize: ctx.docSize,
      uDst: acc,
      uUseDst: 1,
      uOpacity: layer.opacity,
      uBlend: blendIndex(layer.blend),
    };
    const blurPx = layer.type === 'mask' ? ((layer.blur || 0) * 0.0006) / ctx.px : 0;

    if (blurPx > 0.3) {
      // Render the layer on its own, blur it, then blend the blurred copy.
      const solo = glx.acquire(ctx.W, ctx.H);

      glx.draw(spec.program, solo, { ...spec.uniforms, ...common, uUseDst: 0, uOpacity: 1, uBlend: 0 });

      const blurred = this.blur(solo, blurPx);

      glx.release(solo);
      glx.draw(this.textureProgram(), out, {
        ...common,
        uSrc: blurred,
        uWrap: 0,
        uInv: ctx.docInv,
        uBoxPx: [ctx.W, ctx.H],
        uFx: NONE,
        uWarp: NONE,
      });
      glx.release(blurred);
    } else {
      glx.draw(spec.program, out, { ...spec.uniforms, ...common });
    }

    glx.release(spec.temp);
    return out;
  }

  drawEffect(ctx, acc, layer) {
    const glx = this.glx;
    const kind = COVERAGE_KIND[layer.coverage] ?? 0;
    const region = kind >= 1 && kind <= 3;
    let uCov = acc;
    let painted = null;

    if (kind === 4) {
      if (!layer.strokes?.length) {
        return acc;
      }

      uCov = painted = this.strokeTarget(ctx, layer);
    } else if (kind === 3) {
      uCov = this.polygonTexture(ctx, layer);
    }

    let input = acc;
    const content = layer.content;

    if (region && content && (content.magnify !== 1 || content.rotation || content.flipX || content.flipY)) {
      // Maps output pixels back to source pixels around the region centre.
      const zoom = 1 / Math.max(0.05, Number(content.magnify) || 1);
      const cos = Math.cos(-(content.rotation || 0)) * zoom;
      const sin = Math.sin(-(content.rotation || 0)) * zoom;
      const fx = content.flipX ? -1 : 1;
      const fy = content.flipY ? -1 : 1;
      const m = [cos * fx, sin * fx, -sin * fy, cos * fy, 0, 0];

      m[4] = layer.x - (m[0] * layer.x + m[2] * layer.y);
      m[5] = layer.y - (m[1] * layer.x + m[3] * layer.y);
      input = glx.acquire(ctx.W, ctx.H);
      glx.draw(glx.program('transform', TRANSFORM_SHADER), input, { uSrc: acc, uDocSize: ctx.docSize, uMat: toMat3(m) });
    }

    const reveal = layer.effectId === 'original';
    const centre = apply(layerMatrix(layer), layer.center?.x ?? 0, layer.center?.y ?? 0);
    const processed = reveal
      ? this.baseTarget(ctx)
      : this.runEffect(getEffect(layer.effectId), layer.params, layer.seed, input, {
          asp: ctx.asp,
          px: ctx.px,
          center: [centre.x / ctx.unit, centre.y / ctx.unit],
          extent: region ? Math.min(layer.w, layer.h) / 2 / ctx.unit : 0.5,
        });

    if (input !== acc) {
      glx.release(input);
    }

    const out = glx.acquire(ctx.W, ctx.H);

    glx.draw(glx.program('mix', MIX_SHADER), out, {
      uDst: acc,
      uSrc: processed,
      uCov,
      uDocSize: ctx.docSize,
      uInv: toMat3(invert(layerMatrix(layer))),
      uBoxPx: [layer.w * ctx.sx, layer.h * ctx.sy],
      uKind: kind,
      uFeather: region ? (layer.feather || 0) * 0.005 * Math.min(layer.w, layer.h) * ctx.sx : 0,
      uOpacity: layer.opacity,
      uBlend: blendIndex(layer.blend),
    });
    glx.release(painted);

    if (!reveal) {
      glx.release(processed);
    }

    return out;
  }

  /** Runs one effect over `input` and returns a new target. `env` describes the unit space. */
  runEffect(definition, params, seed, input, env) {
    const glx = this.glx;
    let source = input;

    if (definition.blur) {
      const blurPx = definition.blur(params ?? {}) / env.px;

      if (blurPx > 0.3) {
        source = this.blur(input, blurPx);
      }
    }

    const out = glx.acquire(input.width, input.height);

    glx.draw(this.effectProgram(definition), out, {
      ...paramUniforms(definition, params),
      uSrc: source,
      uOrig: input,
      uAsp: env.asp,
      uPx: env.px,
      uSeed: seed || 0,
      uCenter: env.center,
      uExtent: env.extent,
    });

    if (source !== input) {
      glx.release(source);
    }

    return out;
  }

  /** Gaussian blur with a radius in render pixels. Returns a new target; `source` is left alone. */
  blur(source, radiusPx) {
    const glx = this.glx;
    const program = glx.program('blur', BLUR_SHADER);
    const passes = radiusPx > 48 ? 3 : radiusPx > 20 ? 2 : 1;
    const step = radiusPx / Math.sqrt(passes) / 12;
    let current = source;

    for (let pass = 0; pass < passes; pass += 1) {
      const horizontal = glx.acquire(source.width, source.height);
      const vertical = glx.acquire(source.width, source.height);

      glx.draw(program, horizontal, { uSrc: current, uStep: [step / source.width, 0] });
      glx.draw(program, vertical, { uSrc: horizontal, uStep: [0, step / source.height] });
      glx.release(horizontal);

      if (current !== source) {
        glx.release(current);
      }

      current = vertical;
    }

    return current;
  }

  /** Draws a rendered target to the canvas through the viewport transform. */
  present(target, view) {
    const glx = this.glx;

    glx.clear(null);

    if (!target) {
      return;
    }

    glx.draw(glx.program('present', PRESENT_SHADER), null, {
      uSrc: target,
      uScreen: [glx.canvas.width, glx.canvas.height],
      uPan: [view.panX * view.dpr, view.panY * view.dpr],
      uZoom: view.zoom * view.dpr,
      uDocSize: [view.docWidth, view.docHeight],
      uChecker: 8 * view.dpr,
      uCheckA: view.checkA ?? [0.8, 0.8, 0.8],
      uCheckB: view.checkB ?? [0.92, 0.92, 0.92],
    });
  }

  /** Non-premultiplied RGBA pixels of a target, top row first. */
  readStraight(target) {
    const glx = this.glx;
    const straight = glx.acquire(target.width, target.height);

    glx.draw(glx.program('copy', COPY_SHADER), straight, { uSrc: target, uStraight: 1 });

    const pixels = glx.readPixels(straight);

    glx.release(straight);
    return new ImageData(pixels, target.width, target.height);
  }

  /** Renders the document into a 2D canvas (used for export, clipboard and AI sources). */
  toCanvas(doc, options = {}) {
    const target = this.render(doc, options);
    const image = this.readStraight(target);
    const canvas = document.createElement('canvas');

    this.glx.release(target);
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').putImageData(image, 0, 0);
    return canvas;
  }

  /** Copies any image source into a render target (gallery preview input). */
  targetFromSource(source, width, height) {
    const glx = this.glx;
    const entry = glx.textureFromSource(source);
    const target = glx.acquire(width, height);

    glx.draw(glx.program('copy', COPY_SHADER), target, { uSrc: entry, uStraight: 0 });
    glx.deleteTexture(entry);
    return target;
  }

  effectPreview(definition, params, seed, source) {
    const unit = Math.min(source.width, source.height);
    const asp = [source.width / unit, source.height / unit];
    const target = this.runEffect(definition, params, seed, source, {
      asp,
      px: 1 / unit,
      center: [asp[0] / 2, asp[1] / 2],
      extent: 0.5,
    });
    const image = this.readStraight(target);

    this.glx.release(target);
    return image;
  }

  patternPreview(definition, params, seed, source, opacity = 0.75) {
    const glx = this.glx;
    const side = Math.max(source.width, source.height);
    const box = { x: source.width / 2, y: source.height / 2, w: side, h: side, rotation: -0.1, skewX: 0, skewY: 0 };
    const density = (Number(params?.density) || 10) * 0.42;
    const target = glx.acquire(source.width, source.height);

    glx.draw(this.patternProgram(definition), target, {
      ...patternUniforms(definition, params),
      uPatScale: [density, density],
      uAA: density / side,
      uSeed: seed || 0,
      uInv: toMat3(invert(layerMatrix(box))),
      uBoxPx: [side, side],
      uFx: NONE,
      uWarp: NONE,
      uDocSize: [source.width, source.height],
      uDst: source,
      uUseDst: 1,
      uOpacity: opacity,
      uBlend: 0,
    });

    const image = this.readStraight(target);

    glx.release(target);
    return image;
  }
}
