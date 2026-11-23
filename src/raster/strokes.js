// Vector brush strokes rasterised with Canvas 2D.
// A stroke is { tool: 'brush' | 'eraser', type, color, size, opacity, seed, points: [x0, y0, x1, y1, ...] }
// with points in document pixels. A stamp stroke is { tool: 'stamp', emoji, size, opacity, angle,
// spin, style, seed, points }: the emoji drawn at the first point and then every `size × spacing`
// along the path (stamp tool).

import { drawEmoji, emojiArtVersion } from './emojiArt.js';

/** How far apart stamps are along a drag, in stamp sizes. */
export const STAMP_SPACING = 1.1;

export const BRUSH_TYPES = [
  { id: 'smooth', label: 'Smooth' },
  { id: 'marker', label: 'Marker' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'spray', label: 'Spray' },
];

function seededRandom(seed) {
  let state = (Math.floor((seed || 0.5) * 2147483646) % 2147483646) + 1;

  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function tracePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);

  for (let i = 2; i < points.length - 2; i += 2) {
    ctx.quadraticCurveTo(points[i], points[i + 1], (points[i] + points[i + 2]) / 2, (points[i + 1] + points[i + 3]) / 2);
  }

  ctx.lineTo(points[points.length - 2], points[points.length - 1]);
}

/** Calls visit(x, y) at evenly spaced positions along the polyline. */
function walk(points, spacing, visit) {
  let carry = 0;

  visit(points[0], points[1]);

  for (let i = 2; i < points.length; i += 2) {
    const x0 = points[i - 2];
    const y0 = points[i - 1];
    const dx = points[i] - x0;
    const dy = points[i + 1] - y0;
    const length = Math.hypot(dx, dy);

    if (length === 0) {
      continue;
    }

    let at = spacing - carry;

    while (at <= length) {
      visit(x0 + (dx * at) / length, y0 + (dy * at) / length);
      at += spacing;
    }

    carry = length - (at - spacing);
  }
}

function drawStamps(ctx, stroke) {
  const size = Math.max(1, stroke.size || 1);
  const random = seededRandom(stroke.seed);
  const base = ((stroke.angle || 0) * Math.PI) / 180;
  const spin = ((stroke.spin || 0) * Math.PI) / 180;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, stroke.opacity ?? 1));
  walk(stroke.points, size * STAMP_SPACING, (x, y) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(base + (random() * 2 - 1) * spin);
    drawEmoji(ctx, String(stroke.emoji || '🙂').slice(0, 40), size, stroke.style ?? 0);
    ctx.restore();
  });
  ctx.restore();
}

export function drawStroke(ctx, stroke) {
  const points = stroke.points;

  if (!points || points.length < 2) {
    return;
  }

  if (stroke.tool === 'stamp') {
    drawStamps(ctx, stroke);
    return;
  }

  const erase = stroke.tool === 'eraser';
  const size = Math.max(0.5, stroke.size || 1);
  const type = erase ? 'smooth' : stroke.type || 'smooth';
  const color = erase ? '#000000' : stroke.color || '#000000';

  ctx.save();
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  ctx.globalAlpha = Math.max(0, Math.min(1, stroke.opacity ?? 1));
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  if (type === 'dotted') {
    ctx.beginPath();
    walk(points, size * 1.7, (x, y) => {
      ctx.moveTo(x + size / 2, y);
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    });
    ctx.fill();
  } else if (type === 'spray') {
    const random = seededRandom(stroke.seed);
    const dot = Math.max(0.6, size * 0.07);

    ctx.beginPath();
    walk(points, Math.max(1, size * 0.3), (x, y) => {
      for (let i = 0; i < 7; i += 1) {
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random()) * size * 1.2;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;

        ctx.moveTo(px + dot, py);
        ctx.arc(px, py, dot, 0, Math.PI * 2);
      }
    });
    ctx.fill();
  } else if (points.length === 2) {
    ctx.beginPath();
    ctx.arc(points[0], points[1], size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const marker = type === 'marker';

    ctx.lineWidth = marker ? size * 1.3 : size;
    ctx.lineCap = marker ? 'square' : 'round';
    ctx.lineJoin = marker ? 'bevel' : 'round';
    tracePath(ctx, points);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Cached raster of a stroke list. All strokes but the last live in `base`, so the stroke being
 * drawn (or the most recent one) can be redrawn cheaply on every pointer move.
 */
export class StrokeSurface {
  constructor() {
    this.base = document.createElement('canvas');
    this.canvas = document.createElement('canvas');
    this.refs = [];
    this.last = null;
    this.key = '';
  }

  /** Returns true when the pixels in `canvas` changed. */
  sync(strokes, width, height, scaleX, scaleY = scaleX) {
    // Emoji artwork arriving changes how stamps look, so it redraws everything (rare).
    const key = `${width}x${height}@${scaleX},${scaleY}#${strokes.some((stroke) => stroke.tool === 'stamp') ? emojiArtVersion() : 0}`;
    let dirty = false;

    if (key !== this.key) {
      this.base.width = this.canvas.width = width;
      this.base.height = this.canvas.height = height;
      this.key = key;
      this.refs = [];
      this.last = null;
      dirty = true;
    } else if (this.canvas.width !== width || this.canvas.height !== height) {
      // Shrunk while kept for the next export: only the copy with the last stroke needs redoing.
      this.canvas.width = width;
      this.canvas.height = height;
      this.last = null;
      dirty = true;
    }

    const committed = Math.max(0, strokes.length - 1);
    const baseCtx = this.base.getContext('2d');
    let shared = 0;

    while (shared < this.refs.length && shared < committed && this.refs[shared] === strokes[shared]) {
      shared += 1;
    }

    if (shared < this.refs.length) {
      baseCtx.setTransform(1, 0, 0, 1, 0, 0);
      baseCtx.clearRect(0, 0, width, height);
      this.refs = [];
      shared = 0;
      dirty = true;
    }

    baseCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    for (let index = shared; index < committed; index += 1) {
      drawStroke(baseCtx, strokes[index]);
      this.refs.push(strokes[index]);
      dirty = true;
    }

    const last = strokes[strokes.length - 1] ?? null;

    if (!dirty && last === this.last) {
      return false;
    }

    const ctx = this.canvas.getContext('2d');

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(this.base, 0, 0);

    if (last) {
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      drawStroke(ctx, last);
    }

    this.last = last;
    return true;
  }

  /** Frees the copy with the last stroke and keeps `base`, so a later sync only adds new strokes. */
  shrink() {
    this.canvas.width = this.canvas.height = 0;
    this.last = null;
  }

  /** Pixels held while shrunk. */
  get keptPixels() {
    return this.base.width * this.base.height;
  }
}
