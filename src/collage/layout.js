// Collage geometry. A layout is a list of straight cuts across the frame. Each cut is a segment
// (in 0-1 frame coordinates, may reach past the edges); it splits every piece the segment passes
// through along its full line, and leaves the other pieces alone. So a long stroke slices right
// across, and a short one only splits the piece it is drawn on. Pieces stay convex polygons.

const EPS = 1e-6;

/** Flat [x0, y0, x1, y1, ...] → [{x, y}]. */
export const toPoints = (flat) => Array.from({ length: flat.length / 2 }, (_, index) => ({ x: flat[index * 2], y: flat[index * 2 + 1] }));
export const toFlat = (points) => points.flatMap((point) => [point.x, point.y]);

export function area(polygon) {
  let sum = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];

    sum += a.x * b.y - b.x * a.y;
  }

  return sum / 2;
}

export function centroid(polygon) {
  let x = 0;
  let y = 0;
  let total = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const cross = a.x * b.y - b.x * a.y;

    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
    total += cross;
  }

  return Math.abs(total) < EPS ? polygon[0] : { x: x / (3 * total), y: y / (3 * total) };
}

export function bounds(polygon) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function contains(polygon, point) {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];

    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }

  return inside;
}

/** Signed side of `point` relative to the line a→b (positive = left). */
const side = (a, b, point) => (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);

/** Keeps the part of `polygon` where side(a, b, ·) * sign >= offset (Sutherland–Hodgman, one plane). */
function clip(polygon, a, b, sign, offset = 0) {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const value = (point) => (sign * side(a, b, point)) / length - offset;
  const out = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const vc = value(current);
    const vn = value(next);

    if (vc >= 0) {
      out.push(current);
    }

    if ((vc >= 0) !== (vn >= 0)) {
      const t = vc / (vc - vn);

      out.push({ x: current.x + (next.x - current.x) * t, y: current.y + (next.y - current.y) * t });
    }
  }

  // A cut through an existing corner adds the same point twice.
  return out.filter((point, index) => {
    const previous = out[(index + out.length - 1) % out.length];

    return out.length < 2 || Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-3;
  });
}

/** Length of the part of segment a–b inside convex `polygon` (Cyrus–Beck). */
function insideLength(polygon, a, b) {
  const orientation = Math.sign(area(polygon)) || 1;
  let t0 = 0;
  let t1 = 1;

  for (let index = 0; index < polygon.length; index += 1) {
    const p = polygon[index];
    const q = polygon[(index + 1) % polygon.length];
    // Inside is where orientation * side(p, q, ·) >= 0.
    const start = orientation * side(p, q, a);
    const end = orientation * side(p, q, b);

    if (start < 0 && end < 0) {
      return 0;
    }

    if (start < 0 || end < 0) {
      const t = start / (start - end);

      if (start < 0) {
        t0 = Math.max(t0, t);
      } else {
        t1 = Math.min(t1, t);
      }
    }
  }

  return t1 > t0 ? (t1 - t0) * Math.hypot(b.x - a.x, b.y - a.y) : 0;
}

/**
 * Pieces (polygons in pixels, clockwise on screen) for a `width` × `height` frame and `cuts`
 * ([{ a: {x, y}, b: {x, y} }] in 0-1 frame coordinates).
 */
export function cutPieces(width, height, cuts) {
  const minArea = width * height * 0.004;
  let pieces = [[{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }]];

  for (const cut of cuts) {
    const a = { x: cut.a.x * width, y: cut.a.y * height };
    const b = { x: cut.b.x * width, y: cut.b.y * height };

    if (Math.hypot(b.x - a.x, b.y - a.y) < 1) {
      continue;
    }

    pieces = pieces.flatMap((piece) => {
      if (insideLength(piece, a, b) < 1) {
        return [piece];
      }

      const left = clip(piece, a, b, 1);
      const right = clip(piece, a, b, -1);

      return Math.abs(area(left)) < minArea || Math.abs(area(right)) < minArea ? [piece] : [left, right];
    });
  }

  // Reading order (top to bottom, then left to right) so numbering feels natural.
  return pieces
    .map((piece) => ({ piece, centre: centroid(piece) }))
    .sort((p, q) => (Math.abs(p.centre.y - q.centre.y) > height * 0.12 ? p.centre.y - q.centre.y : p.centre.x - q.centre.x))
    .map(({ piece }) => piece);
}

/**
 * Shrinks a piece so neighbours end up `gap` apart, with `gap` around the outside as well.
 * Returns null when the piece disappears.
 */
export function insetPiece(piece, gap, width, height) {
  if (gap <= 0) {
    return piece;
  }

  const orientation = Math.sign(area(piece)) || 1;
  const onBorder = (p, q) =>
    (Math.abs(p.x) < 0.5 && Math.abs(q.x) < 0.5) ||
    (Math.abs(p.y) < 0.5 && Math.abs(q.y) < 0.5) ||
    (Math.abs(p.x - width) < 0.5 && Math.abs(q.x - width) < 0.5) ||
    (Math.abs(p.y - height) < 0.5 && Math.abs(q.y - height) < 0.5);
  let result = piece;

  for (let index = 0; index < piece.length && result.length >= 3; index += 1) {
    const p = piece[index];
    const q = piece[(index + 1) % piece.length];

    if (Math.hypot(q.x - p.x, q.y - p.y) < EPS) {
      continue;
    }

    result = clip(result, p, q, orientation, onBorder(p, q) ? gap : gap / 2);
  }

  return result.length >= 3 && Math.abs(area(result)) > 4 ? result : null;
}

// ── presets ────────────────────────────────────────────────────────────────

const cut = (ax, ay, bx, by) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } });

export const COLLAGE_PRESETS = [
  { id: 'diagonal', name: 'Diagonal split', cuts: [cut(0.62, -0.05, 0.38, 1.05)] },
  { id: 'crossed', name: 'Crossed cuts', cuts: [cut(-0.05, 1, 0.55, -0.05), cut(0.5, -0.05, 0.72, 1.05)] },
  { id: 'slants', name: 'Three slants', cuts: [cut(0.42, -0.05, 0.26, 1.05), cut(0.76, -0.05, 0.6, 1.05)] },
  { id: 'shards', name: 'Shards', cuts: [cut(-0.05, 0.3, 1.05, 0.62), cut(0.35, -0.05, 0.6, 1.05), cut(0.72, -0.05, 1.05, 0.48)] },
  { id: 'feature', name: 'Big and two', cuts: [cut(0.66, -0.05, 0.54, 1.05), cut(0.62, 0.62, 1.05, 0.42)] },
  { id: 'diamond', name: 'Diamond', cuts: [cut(0.45, -0.05, 1.05, 0.55), cut(1.05, 0.45, 0.45, 1.05), cut(0.55, 1.05, -0.05, 0.45), cut(-0.05, 0.55, 0.55, -0.05)] },
  { id: 'tiltedGrid', name: 'Tilted grid', cuts: [cut(0.56, -0.05, 0.44, 1.05), cut(-0.05, 0.44, 1.05, 0.57)] },
  { id: 'banner', name: 'Banner and three', cuts: [cut(-0.05, 0.7, 1.05, 0.62), cut(0.36, 0.76, 0.31, 1.05), cut(0.67, 0.76, 0.72, 1.05)] },
  { id: 'two', name: 'Side by side', cuts: [cut(0.5, -0.05, 0.5, 1.05)] },
  { id: 'grid', name: 'Grid of four', cuts: [cut(0.5, -0.05, 0.5, 1.05), cut(-0.05, 0.5, 1.05, 0.5)] },
  { id: 'row', name: 'Row of three', cuts: [cut(1 / 3, -0.05, 1 / 3, 1.05), cut(2 / 3, -0.05, 2 / 3, 1.05)] },
  { id: 'grid6', name: 'Grid of six', cuts: [cut(1 / 3, -0.05, 1 / 3, 1.05), cut(2 / 3, -0.05, 2 / 3, 1.05), cut(-0.05, 0.5, 1.05, 0.5)] },
];

/** 2-4 random full-width cuts that leave no tiny pieces. */
export function randomCuts(width, height) {
  const point = (edge) => {
    const t = 0.15 + Math.random() * 0.7;

    return [{ x: t, y: -0.05 }, { x: 1.05, y: t }, { x: t, y: 1.05 }, { x: -0.05, y: t }][edge];
  };

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const count = 2 + Math.floor(Math.random() * 3);
    const cuts = [];

    for (let index = 0; index < count; index += 1) {
      const from = Math.floor(Math.random() * 4);
      const to = (from + 1 + Math.floor(Math.random() * 3)) % 4;
      const a = point(from);
      const b = point(to);

      // Every other cut is shortened so it only splits the piece it lands in.
      if (index > 0 && Math.random() < 0.4) {
        const t = 0.35 + Math.random() * 0.3;

        cuts.push({ a: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, b });
      } else {
        cuts.push({ a, b });
      }
    }

    const pieces = cutPieces(width, height, cuts);
    const smallest = Math.min(...pieces.map((piece) => Math.abs(area(piece))));

    if (pieces.length >= 3 && pieces.length <= 6 && smallest > width * height * 0.07) {
      return cuts;
    }
  }

  return COLLAGE_PRESETS[1].cuts;
}
