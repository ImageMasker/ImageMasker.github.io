// 2D affine helpers. A matrix is [a, b, c, d, e, f] meaning x' = a*x + c*y + e, y' = b*x + d*y + f.

export const IDENTITY = [1, 0, 0, 1, 0, 0];

export function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function invert(m) {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12;

  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

export function apply(m, x, y) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Column-major mat3 for GLSL. */
export function toMat3(m) {
  return [m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1];
}

/** Rotation + skew part of a layer's transform (no translation, no size). */
export function layerAxes(layer) {
  const cos = Math.cos(layer.rotation || 0);
  const sin = Math.sin(layer.rotation || 0);
  const kx = Math.tan(layer.skewX || 0);
  const ky = Math.tan(layer.skewY || 0);

  return [cos - sin * ky, sin + cos * ky, cos * kx - sin, sin * kx + cos, 0, 0];
}

/** Maps the layer's local box (-0.5..0.5 on both axes) to document pixels. */
export function layerMatrix(layer) {
  const axes = layerAxes(layer);

  return [axes[0] * layer.w, axes[1] * layer.w, axes[2] * layer.h, axes[3] * layer.h, layer.x, layer.y];
}

export function layerCorners(layer) {
  const m = layerMatrix(layer);

  return [apply(m, -0.5, -0.5), apply(m, 0.5, -0.5), apply(m, 0.5, 0.5), apply(m, -0.5, 0.5)];
}

export function boundsOfPoints(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function layerBounds(layer) {
  return boundsOfPoints(layerCorners(layer));
}

export function pointInPolygon(x, y, points) {
  let inside = false;

  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i];
    const yi = points[i + 1];
    const xj = points[j];
    const yj = points[j + 1];

    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
