// Shapes and arrows (layer types 'shape' and 'arrow'), drawn with Canvas 2D into a texture the size
// the layer is shown at, like text. Everything is drawn in the layer's own box, in document pixels
// times `ratio`, so the preview and the full-size export look the same.
//
// "Hand-drawn" (style 'organic') draws the outline as one marker stroke: it starts somewhere random,
// wobbles a little, drifts so the end overshoots past the start instead of closing neatly, thins out
// at both ends and has a few dry streaks. The randomness comes from the layer's `seed`, so the
// same layer always looks the same; "Draw again" picks a new seed.
//
// An arrow keeps its two ends in its box (`points`: tail x, y, head x, y in -0.5..0.5) and a `bend`:
// how far the middle of the curve is pushed sideways, as a fraction of the distance between the ends.

export const SHAPE_KINDS = [
  { value: 'ellipse', label: 'Circle' },
  { value: 'rect', label: 'Rectangle' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'star', label: 'Star' },
  { value: 'heart', label: 'Heart' },
];
export const SHAPE_FILLS = [
  { value: 'outline', label: 'Outline only' },
  { value: 'fill', label: 'Filled' },
];
export const MARK_STYLES = [
  { value: 'organic', label: 'Hand-drawn' },
  { value: 'clean', label: 'Clean' },
];
export const ARROW_HEADS = [
  { value: 'open', label: 'Open (two strokes)' },
  { value: 'filled', label: 'Filled triangle' },
  { value: 'none', label: 'None (just a line)' },
];

const MAX_SIDE = 4096;
const HEAD_ANGLE = (28 * Math.PI) / 180;

// ── helpers ───────────────────────────────────────────────────────────────

/** Small seeded generator (mulberry32), so a layer's hand-drawn look never changes by itself. */
export function seeded(seed) {
  let state = Math.floor((Number(seed) || 0) * 1e9) >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));

  return t * t * (3 - 2 * t);
};

/** Line width in document pixels that still fits the box. */
function lineWidth(layer) {
  return Math.max(0.5, Math.min(Number(layer.width) || 1, Math.min(layer.w, layer.h) / 3));
}

// ── shape outlines ────────────────────────────────────────────────────────

function polygon(vertices, perEdge = 40) {
  const points = [];

  for (let index = 0; index < vertices.length; index += 1) {
    const [ax, ay] = vertices[index];
    const [bx, by] = vertices[(index + 1) % vertices.length];

    for (let step = 0; step < perEdge; step += 1) {
      const t = step / perEdge;

      points.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  }

  return points;
}

/** The closed outline of a shape kind, scaled to fill -1..1 on both axes, going clockwise. */
export function shapeOutline(kind) {
  let points;

  switch (kind) {
    case 'rect':
      points = polygon([[-1, -1], [1, -1], [1, 1], [-1, 1]]);
      break;
    case 'triangle':
      points = polygon([[0, -1], [1, 1], [-1, 1]], 50);
      break;
    case 'star':
      points = polygon(
        Array.from({ length: 10 }, (_, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI) / 5;
          const radius = index % 2 ? 0.42 : 1;

          return [Math.cos(angle) * radius, Math.sin(angle) * radius];
        }),
        16
      );
      break;
    case 'heart':
      points = Array.from({ length: 200 }, (_, index) => {
        const t = (index / 200) * Math.PI * 2;

        return [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
      });
      break;
    default:
      points = Array.from({ length: 180 }, (_, index) => {
        const angle = -Math.PI / 2 + (index / 180) * Math.PI * 2;

        return [Math.cos(angle), Math.sin(angle)];
      });
  }

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const sx = 2 / (Math.max(...xs) - Math.min(...xs));
  const sy = 2 / (Math.max(...ys) - Math.min(...ys));

  return points.map(([x, y]) => [(x - cx) * sx, (y - cy) * sy]);
}

/** Squeezes points (around 0, 0) so they and half the line width stay inside a w × h box. */
function fitInside(points, w, h, pad) {
  const maxX = Math.max(1e-6, ...points.map(([x]) => Math.abs(x)));
  const maxY = Math.max(1e-6, ...points.map(([, y]) => Math.abs(y)));
  const kx = Math.min(1, Math.max(0.05, w / 2 - pad) / maxX);
  const ky = Math.min(1, Math.max(0.05, h / 2 - pad) / maxY);

  return points.map(([x, y]) => [x * kx, y * ky]);
}

/** Normal (unit, pointing left of travel) at each point of a polyline. */
function normals(points, closed) {
  return points.map((_, index) => {
    const last = points.length - 1;
    const previous = points[index === 0 ? (closed ? last : 0) : index - 1];
    const next = points[index === last ? (closed ? 0 : last) : index + 1];
    const dx = next[0] - previous[0];
    const dy = next[1] - previous[1];
    const length = Math.hypot(dx, dy) || 1;

    return [dy / length, -dx / length];
  });
}

/**
 * The path a shape is drawn along, in box pixels around the centre, and the width at each point
 * (for an outline). Clean shapes are closed; hand-drawn ones are an open stroke that overshoots.
 */
export function shapePath(layer) {
  const width = lineWidth(layer);
  const filled = layer.fill === 'fill';
  const organic = layer.style !== 'clean';
  const pad = filled ? 0 : width / 2;
  const outline = shapeOutline(layer.kind);
  const rx = layer.w / 2 - pad;
  const ry = layer.h / 2 - pad;
  let points = outline.map(([x, y]) => [x * rx, y * ry]);

  if (!organic) {
    return { points: fitInside(points, layer.w, layer.h, pad), widths: null, closed: true, width };
  }

  const random = seeded(layer.seed);
  const count = points.length;
  const start = Math.floor(random() * count);
  // Filled shapes stay closed; outlines go round a bit more than once and drift as they go.
  const overshoot = filled ? 0 : 0.05 + random() * 0.08;
  const drift = filled ? 0 : (random() < 0.5 ? -1 : 1) * (0.025 + random() * 0.03);
  const amplitude = Math.min(rx, ry) * 0.012 + width * 0.12;
  const f1 = 1.3 + random() * 1.4;
  const f2 = 3.2 + random() * 2.5;
  const p1 = random() * Math.PI * 2;
  const p2 = random() * Math.PI * 2;
  const rotated = [...points.slice(start), ...points.slice(0, start)];
  const around = normals(rotated, true);
  const total = Math.round(count * (1 + overshoot));
  const path = [];
  const widths = [];

  for (let step = 0; step <= (filled ? count - 1 : total); step += 1) {
    const t = step / count;
    const [x, y] = rotated[step % count];
    const [nx, ny] = around[step % count];
    const scale = 1 + drift * (t - 0.5);
    const offset = amplitude * (0.6 * Math.sin(Math.PI * 2 * f1 * t + p1) + 0.4 * Math.sin(Math.PI * 2 * f2 * t + p2));
    const u = step / total;

    path.push([x * scale + nx * offset, y * scale + ny * offset]);
    widths.push(width * (0.45 + 0.55 * smoothstep(0, 0.07, u)) * (0.3 + 0.7 * (1 - smoothstep(0.82, 1, u))) * (1 + 0.08 * Math.sin(t * 11 + p2)));
  }

  return { points: fitInside(path, layer.w, layer.h, pad), widths: filled ? null : widths, closed: filled, width };
}

// ── arrows ────────────────────────────────────────────────────────────────

/** Arrowhead length for a line width and arrow length (document pixels). */
export function headLength(width, length) {
  return Math.min(Math.max(width * 3.6, length * 0.17), length * 0.45);
}

/** The arrow's curve in box pixels: ends, control point, and a point at any t. */
export function arrowCurve(a, b, bend) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const control = {
    x: (a.x + b.x) / 2 + normal.x * bend * length,
    y: (a.y + b.y) / 2 + normal.y * bend * length,
  };
  const at = (t) => ({
    x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * control.x + t * t * b.x,
    y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * control.y + t * t * b.y,
  });

  return { a, b, control, length, normal, at };
}

/** How far around the curve the drawing can reach: head, line width and the hand-drawn wobble. */
export function arrowPadding(layer, length) {
  return headLength(Number(layer.width) || 1, length) * 0.75 + (Number(layer.width) || 1) * 1.2 + length * 0.02 + 2;
}

/** The arrow's ends in box pixels (centre of the box is 0, 0). */
export function arrowEnds(layer) {
  const [ax, ay, bx, by] = layer.points ?? [-0.4, 0.4, 0.4, -0.4];

  return [{ x: ax * layer.w, y: ay * layer.h }, { x: bx * layer.w, y: by * layer.h }];
}

/** The arrow's own box around its curve, in the pixels the ends are given in. */
export function arrowBounds(layer, a, b) {
  const curve = arrowCurve(a, b, Number(layer.bend) || 0);
  const pad = arrowPadding(layer, curve.length);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let step = 0; step <= 32; step += 1) {
    const point = curve.at(step / 32);

    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

/** Distance from a box-pixel point to the arrow's curve. */
export function distanceToArrow(layer, x, y) {
  const [a, b] = arrowEnds(layer);
  const curve = arrowCurve(a, b, Number(layer.bend) || 0);
  let best = Infinity;
  let previous = curve.at(0);

  for (let step = 1; step <= 40; step += 1) {
    const point = curve.at(step / 40);
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const t = Math.max(0, Math.min(1, ((x - previous.x) * dx + (y - previous.y) * dy) / (dx * dx + dy * dy || 1)));

    best = Math.min(best, Math.hypot(x - previous.x - dx * t, y - previous.y - dy * t));
    previous = point;
  }

  return best;
}

/** Shaft polyline (box pixels) with widths, and the heads to draw at either end. */
export function arrowParts(layer) {
  const width = Math.max(0.5, Number(layer.width) || 1);
  const organic = layer.style !== 'clean';
  const [a, b] = arrowEnds(layer);
  const curve = arrowCurve(a, b, Number(layer.bend) || 0);
  const head = layer.head === 'filled' || layer.head === 'none' ? layer.head : 'open';
  const size = headLength(width, curve.length);
  const random = seeded(layer.seed);
  const amplitude = organic ? width * 0.25 + curve.length * 0.008 : 0;
  const f1 = 0.7 + random() * 0.8;
  const p1 = random() * Math.PI * 2;
  const count = Math.max(12, Math.min(160, Math.round(curve.length / 4)));
  const shaft = [];
  const widths = [];

  for (let step = 0; step <= count; step += 1) {
    const t = step / count;
    const point = curve.at(t);
    // The wobble fades out at both ends so the heads sit on the line.
    const offset = amplitude * Math.sin(Math.PI * 2 * f1 * t + p1) * Math.sin(Math.PI * t);

    shaft.push([point.x + curve.normal.x * offset, point.y + curve.normal.y * offset]);
    widths.push(organic ? width * (0.5 + 0.5 * smoothstep(0, 0.2, t)) * (1 + 0.06 * Math.sin(t * 9 + p1)) : width);
  }

  const tip = (end) => {
    const from = end ? shaft[shaft.length - 1] : shaft[0];
    const before = end ? shaft[Math.max(0, shaft.length - 4)] : shaft[Math.min(shaft.length - 1, 3)];
    const angle = Math.atan2(from[1] - before[1], from[0] - before[0]);

    return { x: from[0], y: from[1], angle };
  };
  const heads = [];

  if (head !== 'none') {
    heads.push({ ...tip(true), end: true });

    if (layer.bothEnds) {
      heads.push({ ...tip(false), end: false });
    }
  }

  // A filled head covers the end of the line, so the line stops under it.
  let trimmed = shaft;
  let trimmedWidths = widths;

  if (head === 'filled') {
    const kept = shaft
      .map((_, index) => index)
      .filter((index) => heads.every((entry) => Math.hypot(shaft[index][0] - entry.x, shaft[index][1] - entry.y) > size * 0.6));

    if (kept.length >= 2) {
      trimmed = kept.map((index) => shaft[index]);
      trimmedWidths = kept.map((index) => widths[index]);
    }
  }

  return { shaft: trimmed, widths: trimmedWidths, heads, head, size, width, organic, random };
}

// ── drawing ───────────────────────────────────────────────────────────────

/** A stroke whose width changes along it: short round-capped pieces. */
function strokeVarying(context, points, widths) {
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (let index = 1; index < points.length; index += 1) {
    context.lineWidth = Math.max(0.3, (widths[index - 1] + widths[index]) / 2);
    context.beginPath();
    context.moveTo(points[index - 1][0], points[index - 1][1]);
    context.lineTo(points[index][0], points[index][1]);
    context.stroke();
  }
}

function strokeEven(context, points, width, closed) {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = width;
  context.beginPath();
  points.forEach(([x, y], index) => context[index === 0 ? 'moveTo' : 'lineTo'](x, y));

  if (closed) {
    context.closePath();
  }

  context.stroke();
}

function fillPath(context, points) {
  context.beginPath();
  points.forEach(([x, y], index) => context[index === 0 ? 'moveTo' : 'lineTo'](x, y));
  context.closePath();
  context.fill();
}

/** Thin gaps along a marker stroke, like a felt tip running a little dry. */
function streaks(context, points, width, random, ratio) {
  if (width * ratio < 4 || points.length < 3) {
    return;
  }

  const around = normals(points, false);

  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.lineCap = 'round';

  for (let line = 0; line < 3; line += 1) {
    const across = (random() - 0.5) * 0.7 * width;

    context.globalAlpha = 0.25 + random() * 0.25;
    context.lineWidth = width * (0.05 + random() * 0.06);
    context.setLineDash([width * (2 + random() * 6), width * (1 + random() * 4)]);
    context.lineDashOffset = random() * width * 10;
    context.beginPath();
    points.forEach(([x, y], index) => context[index === 0 ? 'moveTo' : 'lineTo'](x + around[index][0] * across, y + around[index][1] * across));
    context.stroke();
  }

  context.restore();
}

function drawShape(context, layer, ratio) {
  const { points, widths, closed, width } = shapePath(layer);

  if (layer.fill === 'fill') {
    fillPath(context, points);
  } else if (widths) {
    strokeVarying(context, points, widths);
    streaks(context, points, width, seeded((Number(layer.seed) || 0) + 0.5), ratio);
  } else {
    strokeEven(context, points, width, closed);
  }
}

function drawHead(context, parts, head) {
  const { size, width, organic, random } = parts;
  const barb = (side) => {
    const turn = HEAD_ANGLE * (organic ? 0.85 + random() * 0.35 : 1);
    const length = size * (organic ? 0.85 + random() * 0.3 : 1);
    const angle = head.angle + Math.PI + side * turn;

    return [head.x + Math.cos(angle) * length, head.y + Math.sin(angle) * length];
  };

  if (parts.head === 'filled') {
    const left = barb(-1);
    const right = barb(1);
    const reach = size * 0.15;
    const tip = [head.x + Math.cos(head.angle) * reach, head.y + Math.sin(head.angle) * reach];

    fillPath(context, [tip, left, right]);
    strokeEven(context, [tip, left, right], Math.max(0.5, width * 0.5), true);
    return;
  }

  for (const side of [-1, 1]) {
    const end = barb(side);

    if (!organic) {
      strokeEven(context, [[head.x, head.y], end], width, false);
      continue;
    }

    // A slightly curved flick from the tip outwards, thinning as it goes.
    const bow = (random() - 0.5) * size * 0.25;
    const mx = (head.x + end[0]) / 2 - Math.sin(head.angle) * bow * side;
    const my = (head.y + end[1]) / 2 + Math.cos(head.angle) * bow * side;
    const points = [];
    const widths = [];

    for (let step = 0; step <= 12; step += 1) {
      const t = step / 12;

      points.push([
        (1 - t) * (1 - t) * head.x + 2 * (1 - t) * t * mx + t * t * end[0],
        (1 - t) * (1 - t) * head.y + 2 * (1 - t) * t * my + t * t * end[1],
      ]);
      widths.push(width * (1 - 0.55 * t));
    }

    strokeVarying(context, points, widths);
  }
}

function drawArrow(context, layer, ratio) {
  const parts = arrowParts(layer);

  if (parts.organic) {
    strokeVarying(context, parts.shaft, parts.widths);
    streaks(context, parts.shaft, parts.width, seeded((Number(layer.seed) || 0) + 0.5), ratio);
  } else {
    strokeEven(context, parts.shaft, parts.width, false);
  }

  for (const head of parts.heads) {
    drawHead(context, parts, head);
  }
}

/** Everything that changes how the layer looks (its size included: it is drawn in its own box). */
export function markSignature(layer) {
  return [
    layer.type, layer.kind, layer.fill, layer.style, layer.color, layer.width, layer.seed, layer.head, layer.bothEnds, layer.bend,
    (layer.points ?? []).join(','), layer.w.toFixed(1), layer.h.toFixed(1),
  ].join('|');
}

/** The scale to draw at: about what it is shown at, at most 4096 px a side. */
export function markRatio(layer, wanted) {
  return Math.max(0.02, Math.min(wanted, MAX_SIDE / Math.max(layer.w, layer.h, 1)));
}

/** Draws a shape or arrow layer into a new canvas the size of its box times `ratio`. */
export function renderMark(layer, ratio) {
  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.ceil(layer.w * ratio));
  canvas.height = Math.max(1, Math.ceil(layer.h * ratio));

  const context = canvas.getContext('2d');

  context.scale(canvas.width / layer.w, canvas.height / layer.h);
  context.translate(layer.w / 2, layer.h / 2);
  context.fillStyle = layer.color;
  context.strokeStyle = layer.color;

  if (layer.type === 'arrow') {
    drawArrow(context, layer, ratio);
  } else {
    drawShape(context, layer, ratio);
  }

  return canvas;
}

// ── line width setting ────────────────────────────────────────────────────

/** The tools' line width setting (1–50) in document pixels: 10 is 2% of the picture's short side. */
export function widthToPx(doc, value) {
  return (Number(value) * Math.min(doc.width, doc.height)) / 500;
}

export function pxToWidth(doc, px) {
  return (Number(px) * 500) / Math.min(doc.width, doc.height);
}

/** The Curve setting (-100..100) as an arrow's `bend`. */
export const CURVE_TO_BEND = 0.006;
