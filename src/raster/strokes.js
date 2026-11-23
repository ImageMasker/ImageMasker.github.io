// Brush strokes and stamps as geometry for the GPU (gl/StrokeRenderer.js draws it).
// A stroke is { tool: 'brush' | 'eraser', type, color, size, opacity, seed, points: [x0, y0, x1, y1, ...] }
// with points in document pixels. A stamp stroke is { tool: 'stamp', emoji, size, opacity, angle,
// spin, style, seed, points }: the emoji drawn at the first point and then every `size × spacing`
// along the path (stamp tool). Smooth and marker strokes curve through the midpoints between
// their points; the eraser's strokes take pixels away.

/** How far apart stamps are along a drag, in stamp sizes. */
export const STAMP_SPACING = 1.1;

export const BRUSH_TYPES = [
  { id: 'smooth', label: 'Smooth' },
  { id: 'marker', label: 'Marker' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'spray', label: 'Spray' },
];

export function seededRandom(seed) {
  let state = (Math.floor((seed || 0.5) * 2147483646) % 2147483646) + 1;

  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

/** Calls visit(x, y) at evenly spaced positions along the polyline. */
export function walk(points, spacing, visit) {
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

/**
 * How far a smoothed piece may stray from the true curve, in document pixels. Small enough that
 * an export at full size can't show the corners.
 */
const CURVE_TOLERANCE = 0.2;
const geometryCache = new WeakMap();

/** Pushes the quadratic curve a → c → b as line pieces (flattened to CURVE_TOLERANCE). */
function flattenQuad(out, ax, ay, cx, cy, bx, by) {
  const deviation = Math.hypot(ax - 2 * cx + bx, ay - 2 * cy + by) / 4;
  const pieces = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(deviation / CURVE_TOLERANCE))));

  for (let step = 1; step <= pieces; step += 1) {
    const t = step / pieces;
    const u = 1 - t;

    out.push(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by);
  }
}

/** A stroke's path as a polyline: from the first point through the midpoints, curving at each point, to the last. */
export function smoothedPath(points) {
  const out = [points[0], points[1]];
  let x = points[0];
  let y = points[1];

  for (let i = 2; i < points.length - 2; i += 2) {
    const mx = (points[i] + points[i + 2]) / 2;
    const my = (points[i + 1] + points[i + 3]) / 2;

    flattenQuad(out, x, y, points[i], points[i + 1], mx, my);
    x = mx;
    y = my;
  }

  out.push(points[points.length - 2], points[points.length - 1]);
  return out;
}

/**
 * A stroke as shapes for the GPU, in document pixels so one geometry serves every scale:
 * `pieces` holds [x0, y0, x1, y1, radius, ends] per line piece (a dot is a piece of length 0;
 * `ends` is 1 for a square start, 2 for a square end, 3 for both: the marker's two ends, the
 * rest is round), `stamps` holds [x, y, size, angle] per stamp. Cached per
 * stroke object; strokes are never changed in place except the one being drawn, which gets a new
 * object on every move.
 */
export function strokeGeometry(stroke) {
  let geometry = geometryCache.get(stroke);

  if (geometry) {
    return geometry;
  }

  const points = stroke.points ?? [];
  const pieces = [];
  const stamps = [];
  const piece = (x0, y0, x1, y1, radius, square = 0) => pieces.push(x0, y0, x1, y1, radius, square);

  if (points.length < 2) {
    // Nothing to draw.
  } else if (stroke.tool === 'stamp') {
    const size = Math.max(1, stroke.size || 1);
    const random = seededRandom(stroke.seed);
    const base = ((stroke.angle || 0) * Math.PI) / 180;
    const spin = ((stroke.spin || 0) * Math.PI) / 180;

    walk(points, size * STAMP_SPACING, (x, y) => stamps.push(x, y, size, base + (random() * 2 - 1) * spin));
  } else {
    const size = Math.max(0.5, stroke.size || 1);
    const type = stroke.tool === 'eraser' ? 'smooth' : stroke.type || 'smooth';

    if (type === 'dotted') {
      walk(points, size * 1.7, (x, y) => piece(x, y, x, y, size / 2));
    } else if (type === 'spray') {
      const random = seededRandom(stroke.seed);
      const dot = Math.max(0.6, size * 0.07);

      walk(points, Math.max(1, size * 0.3), (x, y) => {
        for (let i = 0; i < 7; i += 1) {
          const angle = random() * Math.PI * 2;
          const radius = Math.sqrt(random()) * size * 1.2;
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius;

          piece(px, py, px, py, dot);
        }
      });
    } else if (points.length === 2) {
      piece(points[0], points[1], points[0], points[1], size / 2);
    } else {
      const marker = type === 'marker';
      const radius = (marker ? size * 1.3 : size) / 2;
      const path = smoothedPath(points);

      for (let i = 2; i < path.length; i += 2) {
        piece(path[i - 2], path[i - 1], path[i], path[i + 1], radius, marker ? (i === 2 ? 1 : 0) | (i === path.length - 2 ? 2 : 0) : 0);
      }
    }
  }

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const grow = (x, y, reach) => {
    x0 = Math.min(x0, x - reach);
    y0 = Math.min(y0, y - reach);
    x1 = Math.max(x1, x + reach);
    y1 = Math.max(y1, y + reach);
  };

  for (let i = 0; i < pieces.length; i += 6) {
    // A square end reaches √2 × radius out at its corners.
    const reach = pieces[i + 4] * (pieces[i + 5] ? Math.SQRT2 : 1);

    grow(pieces[i], pieces[i + 1], reach);
    grow(pieces[i + 2], pieces[i + 3], reach);
  }

  for (let i = 0; i < stamps.length; i += 4) {
    // Emoji drawn with the device's font can be a little wider than the stamp size.
    grow(stamps[i], stamps[i + 1], stamps[i + 2]);
  }

  geometry = { pieces: new Float32Array(pieces), stamps: new Float32Array(stamps), bounds: x0 <= x1 ? [x0, y0, x1, y1] : null };
  geometryCache.set(stroke, geometry);
  return geometry;
}
