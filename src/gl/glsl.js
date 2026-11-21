// Shared GLSL building blocks. All colours are premultiplied RGBA.

export const HEAD = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
#define PI 3.14159265359
#define TAU 6.28318530718
`;

export const LIB = `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash32(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.7; a *= 0.5; }
  return s;
}
vec2 noise2(vec2 p) { return vec2(vnoise(p), vnoise(p + vec2(37.2, 91.7))); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 hueRotate(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
`;

// Cell helpers that depend on the per-layer seed.
export const CELLS = `
struct Vor { vec2 id; vec2 center; float edge; vec2 n; };
Vor voronoi(vec2 x, float jitter) {
  vec2 n = floor(x), f = fract(x);
  vec2 mg = vec2(0.0), mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.5 + jitter * (hash22(n + g + SEEDV) - 0.5);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  float ed = 8.0;
  vec2 en = vec2(0.0, 1.0);
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 o = 0.5 + jitter * (hash22(n + g + SEEDV) - 0.5);
    vec2 r = g + o - f;
    vec2 dr = r - mr;
    if (dot(dr, dr) > 1e-5) {
      vec2 dn = normalize(dr);
      float d = dot(0.5 * (mr + r), dn);
      if (d < ed) { ed = d; en = dn; }
    }
  }
  Vor v;
  v.id = n + mg;
  v.center = x + mr;
  v.edge = ed;
  v.n = en;
  return v;
}
// Pointy-top hexagons one unit wide. xy = offset from the cell centre, zw = cell id.
vec4 hexCell(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + 0.5);
}
float hexEdge(vec2 f) { f = abs(f); return 0.5 - max(dot(f, vec2(0.5, 0.8660254)), f.x); }
`;

export const BLEND = `
vec3 blendFn(int m, vec3 b, vec3 s) {
  if (m == 1) return b * s;
  if (m == 2) return b + s - b * s;
  if (m == 3) return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));
  if (m == 4) return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b)) - b), step(0.5, s));
  if (m == 5) return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, s));
  if (m == 6) return min(b, s);
  if (m == 7) return max(b, s);
  if (m == 8) return abs(b - s);
  if (m == 9) return b + s - 2.0 * b * s;
  if (m == 10) return min(b + s, 1.0);
  if (m == 11) return min(b / max(1.0 - s, 1e-4), 1.0);
  if (m == 12) return 1.0 - min((1.0 - b) / max(s, 1e-4), 1.0);
  return s;
}
vec4 composite(vec4 dst, vec4 src, int m) {
  if (m == 0) return src + dst * (1.0 - src.a);
  vec3 b = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
  vec3 s = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
  vec3 bl = clamp(blendFn(m, b, s), 0.0, 1.0);
  return vec4(src.rgb * (1.0 - dst.a) + dst.rgb * (1.0 - src.a) + src.a * dst.a * bl, src.a + dst.a * (1.0 - src.a));
}
`;

export const BLEND_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'soft-light', label: 'Soft light' },
  { id: 'hard-light', label: 'Hard light' },
  { id: 'darken', label: 'Darken' },
  { id: 'lighten', label: 'Lighten' },
  { id: 'difference', label: 'Difference' },
  { id: 'exclusion', label: 'Exclusion' },
  { id: 'add', label: 'Add' },
  { id: 'color-dodge', label: 'Color dodge' },
  { id: 'color-burn', label: 'Color burn' },
];

export function blendIndex(id) {
  const index = BLEND_MODES.findIndex((mode) => mode.id === id);
  return index === -1 ? 0 : index;
}

/**
 * Content layer pass: draws one layer (texture, flat colour or procedural pattern) over uDst.
 * `source` must define `vec4 layerColor(vec2 local)` returning premultiplied colour for a point
 * in the layer's local box (-0.5..0.5 on both axes).
 */
export function layerShader(source) {
  return `${HEAD}${LIB}${BLEND}
uniform sampler2D uDst;
uniform vec2 uDocSize;
uniform mat3 uInv;
uniform vec2 uBoxPx;
uniform float uOpacity;
uniform int uBlend;
uniform int uUseDst;
uniform vec4 uFx;    // hue (radians), invert, noise, edge AA on/off
uniform vec4 uWarp;  // amount, scale, seed, unused
${source}
void main() {
  vec2 doc = vUv * uDocSize;
  vec2 local = (uInv * vec3(doc, 1.0)).xy;
  if (uWarp.x > 0.0) {
    local += (noise2(local * uWarp.y + uWarp.z * 31.7) - 0.5) * uWarp.x;
  }
  vec4 src = layerColor(local);
  if (uFx.w > 0.5) {
    vec2 edge = (0.5 - abs(local)) * uBoxPx;
    src *= clamp(min(edge.x, edge.y) + 0.5, 0.0, 1.0);
  }
  if (src.a > 0.0 && (uFx.x != 0.0 || uFx.y > 0.5 || uFx.z > 0.0)) {
    vec3 c = src.rgb / src.a;
    if (uFx.x != 0.0) c = hueRotate(c, uFx.x);
    if (uFx.y > 0.5) c = 1.0 - c;
    if (uFx.z > 0.0) c += (hash32(floor(doc) + uWarp.z * 91.3) - 0.5) * uFx.z;
    src.rgb = clamp(c, 0.0, 1.0) * src.a;
  }
  src *= uOpacity;
  vec4 dst = uUseDst == 1 ? texture(uDst, vUv) : vec4(0.0);
  outColor = composite(dst, src, uBlend);
}`;
}

export const LAYER_TEXTURE = `
uniform sampler2D uSrc;
uniform int uWrap;   // 0 = transparent outside the box, 1 = mirrored tiling
vec4 layerColor(vec2 local) {
  vec2 uv = local + 0.5;
  if (uWrap == 1) {
    uv = abs(mod(uv + 1.0, 2.0) - 1.0);
  } else if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    return vec4(0.0);
  }
  return texture(uSrc, uv);
}`;

export const LAYER_SOLID = `
uniform vec4 uColor;
uniform float uCorner;
vec4 layerColor(vec2 local) {
  vec2 p = abs(local) * uBoxPx - uBoxPx * 0.5 + uCorner;
  float d = length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - uCorner;
  return uColor * clamp(0.5 - d, 0.0, 1.0);
}`;

/** Effect-layer merge: mixes the processed image over the untouched one through a coverage mask. */
export const MIX_SHADER = `${HEAD}${BLEND}
uniform sampler2D uDst;
uniform sampler2D uSrc;
uniform sampler2D uCov;
uniform vec2 uDocSize;
uniform mat3 uInv;
uniform vec2 uBoxPx;
uniform int uKind;      // 0 full, 1 rect, 2 ellipse, 3 texture in box space, 4 texture in doc space
uniform float uFeather; // in render pixels
uniform float uOpacity;
uniform int uBlend;
void main() {
  vec4 dst = texture(uDst, vUv);
  vec4 fx = texture(uSrc, vUv);
  float cov = 1.0;
  if (uKind == 1 || uKind == 2 || uKind == 3) {
    vec2 local = (uInv * vec3(vUv * uDocSize, 1.0)).xy;
    float f = max(uFeather, 0.75);
    if (uKind == 1) {
      vec2 e = (0.5 - abs(local)) * uBoxPx;
      cov = clamp(min(e.x, e.y) / f + 0.5, 0.0, 1.0);
    } else if (uKind == 2) {
      float r = length(local) * 2.0;
      float px = min(uBoxPx.x, uBoxPx.y) * 0.5;
      cov = clamp((1.0 - r) * px / f + 0.5, 0.0, 1.0);
    } else {
      vec2 uv = local + 0.5;
      cov = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : texture(uCov, uv).a;
    }
    if (uFeather > 0.75) cov = smoothstep(0.0, 1.0, cov);
  } else if (uKind == 4) {
    cov = texture(uCov, vUv).a;
  }
  vec4 result = uBlend == 0 ? fx : composite(dst, fx, uBlend);
  outColor = mix(dst, result, cov * uOpacity);
}`;

/** Resamples a doc-aligned texture through a 3x3 matrix (used for region content transforms). */
export const TRANSFORM_SHADER = `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uDocSize;
uniform mat3 uMat;
void main() {
  vec2 p = (uMat * vec3(vUv * uDocSize, 1.0)).xy;
  outColor = texture(uSrc, p / uDocSize);
}`;

export const BLUR_SHADER = `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uStep;   // uv offset per tap
void main() {
  vec4 acc = vec4(0.0);
  float total = 0.0;
  for (int i = -12; i <= 12; i++) {
    float t = float(i) / 12.0;
    float w = exp(-4.5 * t * t);
    acc += texture(uSrc, vUv + uStep * float(i)) * w;
    total += w;
  }
  outColor = acc / total;
}`;

export const COPY_SHADER = `${HEAD}
uniform sampler2D uSrc;
uniform int uStraight;
void main() {
  vec4 c = texture(uSrc, vUv);
  outColor = uStraight == 1 && c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : c;
}`;

export const PRESENT_SHADER = `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uScreen;
uniform vec2 uPan;
uniform float uZoom;
uniform vec2 uDocSize;
uniform float uChecker;
uniform vec3 uCheckA;
uniform vec3 uCheckB;
void main() {
  vec2 s = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  vec2 d = (s - uPan) / uZoom;
  if (d.x < 0.0 || d.y < 0.0 || d.x > uDocSize.x || d.y > uDocSize.y) { outColor = vec4(0.0); return; }
  vec4 c = texture(uSrc, d / uDocSize);
  vec2 cell = floor(s / uChecker);
  vec3 bg = mix(uCheckA, uCheckB, mod(cell.x + cell.y, 2.0));
  outColor = vec4(c.rgb + bg * (1.0 - c.a), 1.0);
}`;
