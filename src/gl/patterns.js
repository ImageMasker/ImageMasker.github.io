// Procedural overlay masks. Each pattern defines `vec4 pattern(vec2 p)` returning a premultiplied
// colour for a point in pattern space (one unit = one repeat). Patterns are infinite, so they always
// cover the canvas no matter how the layer is moved, rotated or zoomed.
//   uAA   size of one render pixel in pattern units (for anti-aliasing)
//   two(t) mixes the main colour (t = 1) over the background colour, honouring "Background" opacity

import { paramUniforms } from './effects.js';
import { CELLS } from './glsl.js';

const R = (key, label, min, max, value, step = 1) => ({ key, label, type: 'range', min, max, value, step });
const C = (key, label, value) => ({ key, label, type: 'color', value });
const O = (key, label, options, value = 0) => ({ key, label, type: 'select', options, value });

const A = (value = '#1b1b1f') => C('a', 'Colour', value);
const B = (value = '#f4efe6') => C('b', 'Background', value);
const BG = (value = 0) => R('bg', 'Background opacity', 0, 100, value);
const DENSITY = (value) => R('density', 'Density', 2, 120, value);

// ── woven patterns ────────────────────────────────────────────────────────
//
// Ed Harvey's Weave effect for paint.net (2008), which made the classic Weave mask, with his Wobble
// warp on top, which made The wobbler (Bendy weave took more steps than that and stays a picture).
// Rebuilt from his code:
// strips one unit wide with gaps of `gap` % of that; each strip shows over a run of cells and
// spans the gaps at both ends, black at its ends and clear in the middle (his gradient blend
// 0, .9, 1, 1, .9, 0 at 0, .17, .4, .6, .83, 1, stretched over the whole run); solid where two
// gaps cross. Plain is his weave (over one, under one); Twill, Herringbone and Basket change which
// strip is on top in each cell. Wobble moves each point sideways along `wobangle` by a sine of its
// position across it; a second pass can go on top. Shading, Shine and Stretch are extras.
// `weave` itself is reached through the classic presets (masks/maskData.js); the others are listed.

const WEAVE_STYLES = ['Plain', 'Twill', 'Herringbone', 'Basket'];

const WEAVE_FRAG = `
bool weaveOver(vec2 c) {
  if (p_style < 0.5) return mod(c.x + c.y, 2.0) < 0.5;
  if (p_style < 1.5) return mod(c.x + c.y, 4.0) < 1.5;
  if (p_style < 2.5) {
    float k = mod(floor(c.x / 4.0), 2.0) < 0.5 ? c.x + c.y : c.y - c.x;
    return mod(k, 4.0) < 1.5;
  }
  return mod(floor(c.x / 2.0) + floor(c.y / 2.0), 2.0) < 0.5;
}
// Where along its run (0..1) the vertical strip of column cx that shows in row cy is at v.
float weaveRunV(float v, float cx, float cy, float h, float g) {
  float r0 = cy;
  float r1 = cy;
  for (int k = 0; k < 4; k++) { if (!weaveOver(vec2(cx, r0 - 1.0))) break; r0 -= 1.0; }
  for (int k = 0; k < 4; k++) { if (!weaveOver(vec2(cx, r1 + 1.0))) break; r1 += 1.0; }
  return (v - (r0 * h - g)) / ((r1 - r0 + 1.0) * h + 2.0 * g);
}
float weaveRunH(float u, float cx, float cy, float h, float g) {
  float r0 = cx;
  float r1 = cx;
  for (int k = 0; k < 4; k++) { if (weaveOver(vec2(r0 - 1.0, cy))) break; r0 -= 1.0; }
  for (int k = 0; k < 4; k++) { if (weaveOver(vec2(r1 + 1.0, cy))) break; r1 += 1.0; }
  return (u - (r0 * h - g)) / ((r1 - r0 + 1.0) * h + 2.0 * g);
}
// Ed's gradient: how clear the strip is at t (0 at its ends, 1 in the middle).
float weaveClear(float t) {
  float f = t < 0.17 ? 0.9 * t / 0.17
    : t < 0.4 ? 0.9 + 0.1 * (t - 0.17) / 0.23
    : t < 0.6 ? 1.0
    : t < 0.83 ? 1.0 - 0.1 * (t - 0.6) / 0.23
    : 0.9 * (1.0 - t) / 0.17;
  return clamp(f, 0.0, 1.0);
}
// q in strip widths: x = how dark, y = how clear the strip is there (for Shine; 0 in gaps).
vec2 weaveAt(vec2 q, float g) {
  float h = 1.0 + 2.0 * g;
  vec2 c = floor((q + g) / h);
  vec2 f = q + g - c * h;
  bool gx = f.x < 2.0 * g;
  bool gy = f.y < 2.0 * g;
  float t;

  if (gx && gy) return vec2(1.0, 0.0);
  if (gy) {
    if (weaveOver(c)) t = weaveRunV(q.y, c.x, c.y, h, g);
    else if (weaveOver(c - vec2(0.0, 1.0))) t = weaveRunV(q.y, c.x, c.y - 1.0, h, g);
    else return vec2(1.0, 0.0);
  } else if (gx) {
    if (!weaveOver(c)) t = weaveRunH(q.x, c.x, c.y, h, g);
    else if (!weaveOver(c - vec2(1.0, 0.0))) t = weaveRunH(q.x, c.x - 1.0, c.y, h, g);
    else return vec2(1.0, 0.0);
  } else {
    t = weaveOver(c) ? weaveRunV(q.y, c.x, c.y, h, g) : weaveRunH(q.x, c.x, c.y, h, g);
  }

  float clearness = weaveClear(t);
  return vec2((1.0 - clearness) * p_shade * 0.01, clearness);
}
// One pass of Ed's Wobble, undone: where the point came from.
vec2 unwobble(vec2 s, float amount, float len, float deg, float phase) {
  float a = radians(deg);
  float d = amount * 0.01 * sin(dot(s, vec2(sin(a), cos(a))) * TAU / max(len, 0.01) + radians(phase));
  return s + d * vec2(cos(a), -sin(a));
}
vec4 pattern(vec2 p) {
  // Ed's maths is in picture pixels, y going down.
  p.y = -p.y;
  float g = p_gap * 0.01;
  // One repeat of the plain weave is two cells each way.
  float repeat = 2.0 + 4.0 * g;
  mat2 turn = rot(radians(p_angle));
  vec2 stretch = vec2(100.0 / max(p_stretch, 1.0), 1.0);
  vec2 sum = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 s = p + (vec2(float(i & 1), float(i >> 1)) - 0.5) * 0.5 * uAA;
    s = unwobble(s, p_wobble2, p_wavelen2, p_wobangle2, p_phase2);
    s = unwobble(s, p_wobble, p_wavelen, p_wobangle, p_phase);
    // Row-vector product: turns the picture by -angle into the weave (Ed's brush rotation).
    sum += weaveAt(s * turn * repeat * stretch, g);
  }
  sum *= 0.25;
  float dark = sum.x;
  float light = sum.y * p_shine * 0.01 * (1.0 - dark);
  vec4 back = vec4(p_b, 1.0) * p_bg * 0.01;
  vec4 under = vec4(vec3(light), light) + back * (1.0 - light);
  return vec4(p_a, 1.0) * dark + under * (1.0 - dark);
}`;

/** A woven pattern: the weave shader with its own name and default settings. */
function weavePattern({ id, name, hidden = false, values = {} }) {
  const params = [
    DENSITY(15),
    O('style', 'Weave', WEAVE_STYLES, 0),
    R('gap', 'Gap', 0, 60, 15),
    R('angle', 'Angle', -90, 90, 45),
    R('shade', 'Shading', 0, 100, 100),
    R('shine', 'Shine', 0, 100, 0),
    R('stretch', 'Stretch', 40, 250, 100),
    R('wobble', 'Wobble', 0, 200, 0),
    R('wavelen', 'Wobble length', 0.25, 25, 1, 0.05),
    R('wobangle', 'Wobble direction', -90, 90, 0),
    R('phase', 'Wobble phase', 0, 360, 0),
    R('wobble2', 'Second wobble', 0, 200, 0),
    R('wavelen2', 'Second wobble length', 0.25, 25, 4, 0.05),
    R('wobangle2', 'Second wobble direction', -90, 90, 90),
    R('phase2', 'Second wobble phase', 0, 360, 0),
    A('#000000'),
    B(),
    BG(0),
  ].map((param) => (param.key in values ? { ...param, value: values[param.key] } : param));

  return {
    id,
    name,
    hidden,
    main: ['density', 'style', 'gap', 'angle', 'shade', 'shine', 'wobble', 'wavelen', 'wobangle', 'a'],
    params,
    frag: WEAVE_FRAG,
  };
}

export const PATTERNS = [
  {
    id: 'lattice',
    fixed: ['width'],
    name: 'Lattice',
    params: [DENSITY(9), R('width', 'Band width', 10, 95, 36), R('shade', 'Shading', 0, 100, 60), A('#17171c'), B(), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  p = rot(0.7854) * p;
  vec2 id = floor(p);
  vec2 f = fract(p) - 0.5;
  float w = p_width * 0.005;
  float bx = 1.0 - smoothstep(w - uAA, w + uAA, abs(f.x));
  float by = 1.0 - smoothstep(w - uAA, w + uAA, abs(f.y));
  bool xTop = mod(id.x + id.y, 2.0) < 0.5;
  float sx = 1.0 - p_shade * 0.008 * pow(abs(f.y) * 2.0, 2.0) * (xTop ? 0.35 : 1.0);
  float sy = 1.0 - p_shade * 0.008 * pow(abs(f.x) * 2.0, 2.0) * (xTop ? 1.0 : 0.35);
  float rx = 1.0 - 0.5 * p_shade * 0.01 * pow(abs(f.x) / w, 4.0);
  float ry = 1.0 - 0.5 * p_shade * 0.01 * pow(abs(f.y) / w, 4.0);
  vec3 tint = mix(p_a, vec3(1.0), 0.16);
  vec4 cx = vec4(tint * sx * rx, 1.0) * bx;
  vec4 cy = vec4(tint * sy * ry, 1.0) * by;
  vec4 bands = xTop ? cx + cy * (1.0 - cx.a) : cy + cx * (1.0 - cy.a);
  vec4 back = vec4(p_b, 1.0) * p_bg * 0.01;
  return bands + back * (1.0 - bands.a);
}`,
  },
  weavePattern({ id: 'weave', name: 'Weave', hidden: true }),
  weavePattern({ id: 'twill', name: 'Twill', values: { style: 1, angle: 0, density: 16 } }),
  weavePattern({ id: 'herringbone', name: 'Herringbone', values: { style: 2, angle: 0, density: 16 } }),
  weavePattern({ id: 'basket', name: 'Basket weave', values: { style: 3, angle: 0, density: 9, gap: 10, shine: 35 } }),
  weavePattern({ id: 'rippledWeave', name: 'Rippled weave', values: { density: 13, wobble: 35, wavelen: 3, wobble2: 35, wavelen2: 3, wobangle2: 90 } }),
  weavePattern({ id: 'wavyTwill', name: 'Wavy twill', values: { style: 1, angle: 0, density: 16, wobble: 60, wavelen: 6, wobangle: 90 } }),
  {
    id: 'mesh',
    fixed: ['width'],
    name: 'Mesh',
    params: [DENSITY(18), R('width', 'Line width', 2, 60, 22), R('angle', 'Weave angle', 0, 90, 45), A('#101014'), B(), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  p = rot(radians(p_angle)) * p;
  vec2 f = abs(fract(p) - 0.5);
  float e = 0.5 - max(f.x, f.y);
  float w = p_width * 0.005;
  return two(1.0 - smoothstep(w - uAA, w + uAA, e));
}`,
  },
  {
    id: 'honeycomb',
    fixed: ['width'],
    name: 'Honeycomb',
    params: [DENSITY(12), R('width', 'Line width', 2, 60, 20), A('#1a1a20'), B('#f5c542'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  vec4 hx = hexCell(p);
  float w = p_width * 0.004;
  return two(1.0 - smoothstep(w - uAA, w + uAA, hexEdge(hx.xy)));
}`,
  },
  {
    id: 'stripes',
    fixed: ['ratio'],
    name: 'Stripes',
    params: [DENSITY(18), R('ratio', 'Stripe width', 5, 95, 50), A('#e4572e'), B('#fff6e5'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float w = p_ratio * 0.005;
  return two(1.0 - smoothstep(w - uAA, w + uAA, abs(fract(p.y) - 0.5)));
}`,
  },
  {
    id: 'zebra',
    fixed: ['ratio'],
    name: 'Zebra',
    seeded: true,
    params: [DENSITY(12), R('ratio', 'Stripe width', 5, 95, 52), R('wobble', 'Wobble', 0, 100, 60), A('#111114'), B('#f6f1e7'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float y = p.y + (fbm(p * 0.35 + SEEDV) - 0.48) * p_wobble * 0.09;
  float w = p_ratio * 0.005;
  float d = abs(fract(y) - 0.5);
  float aa = uAA * (1.0 + p_wobble * 0.03);
  return two(1.0 - smoothstep(w - aa, w + aa, d));
}`,
  },
  {
    id: 'waves',
    fixed: ['ratio'],
    name: 'Waves',
    params: [DENSITY(16), R('ratio', 'Band width', 5, 95, 50), R('amp', 'Wave height', 0, 100, 45), A('#1f6f8b'), B('#e8f7f9'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float y = p.y + sin(p.x * PI) * p_amp * 0.006;
  float w = p_ratio * 0.005;
  float aa = uAA * (1.0 + p_amp * 0.02);
  return two(1.0 - smoothstep(w - aa, w + aa, abs(fract(y) - 0.5)));
}`,
  },
  {
    id: 'chevron',
    fixed: ['ratio'],
    name: 'Chevron',
    params: [DENSITY(14), R('ratio', 'Band width', 5, 95, 50), R('slope', 'Slope', 10, 200, 100), A('#2d3142'), B('#ffd166'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float y = p.y + abs(fract(p.x * 0.5) - 0.5) * p_slope * 0.02;
  float w = p_ratio * 0.005;
  float aa = uAA * (1.0 + p_slope * 0.01);
  return two(1.0 - smoothstep(w - aa, w + aa, abs(fract(y) - 0.5)));
}`,
  },
  {
    id: 'checker',
    name: 'Checker',
    params: [DENSITY(12), A('#141418'), B('#f3ede2'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  vec2 f = abs(fract(p) - 0.5);
  float e = 0.5 - max(f.x, f.y);
  float t = mod(floor(p.x) + floor(p.y), 2.0);
  return two(mix(0.5, t, smoothstep(0.0, uAA, e)));
}`,
  },
  {
    id: 'harlequin',
    fixed: ['line'],
    name: 'Harlequin',
    params: [DENSITY(9), R('line', 'Line width', 0, 40, 10), A('#c8553d'), B('#f1e0c5'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  vec2 g = rot(0.7854) * (p * vec2(1.0, 0.62));
  vec2 f = abs(fract(g) - 0.5);
  float e = 0.5 - max(f.x, f.y);
  float t = mod(floor(g.x) + floor(g.y), 2.0);
  vec4 col = two(mix(0.5, t, smoothstep(0.0, uAA, e)));
  vec2 h = abs(fract(g + 0.5) - 0.5);
  float d = 0.5 - max(h.x, h.y);
  float w = p_line * 0.002;
  float ln = (1.0 - smoothstep(w - uAA, w + uAA, d)) * step(0.5, p_line);
  return mix(col, vec4(p_a * 0.35, 1.0), ln);
}`,
  },
  {
    id: 'dots',
    fixed: ['size'],
    name: 'Polka dots',
    params: [DENSITY(12), R('size', 'Dot size', 5, 98, 55), A('#d7263d'), B('#fff8f0'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float r = p_size * 0.005;
  return two(1.0 - smoothstep(r - uAA, r + uAA, length(hexCell(p).xy)));
}`,
  },
  {
    id: 'bubbles',
    fixed: ['size'],
    name: 'Bubbles',
    seeded: true,
    params: [DENSITY(8), R('size', 'Bubble size', 20, 100, 70), R('hues', 'Colour variety', 0, 100, 60), A('#6c5ce7'), B('#f8f4ec'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  vec4 col = vec4(p_b, 1.0) * p_bg * 0.01;
  vec2 id0 = floor(p);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = id0 + vec2(float(i), float(j));
    vec3 h = hash32(id + SEEDV);
    vec2 c = id + 0.5 + (h.xy - 0.5) * 0.8;
    float r = (0.18 + 0.4 * h.z) * p_size * 0.01;
    float d = length(p - c);
    vec3 cc = hueRotate(p_a, (hash21(id * 1.9 + SEEDV) - 0.5) * p_hues * 0.06);
    float m = 1.0 - smoothstep(r - uAA, r + uAA, d);
    float ring = 1.0 - smoothstep(r * 0.55 - uAA, r * 0.55 + uAA, d);
    col = mix(col, vec4(mix(cc, mix(cc, vec3(1.0), 0.45), ring), 1.0), m);
  }
  return col;
}`,
  },
  {
    id: 'confetti',
    fixed: ['size'],
    name: 'Confetti',
    seeded: true,
    params: [DENSITY(12), R('size', 'Piece size', 20, 100, 65), R('hues', 'Colour variety', 0, 100, 100), A('#ff5d8f'), B('#fffaf0'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  vec4 col = vec4(p_b, 1.0) * p_bg * 0.01;
  vec2 id0 = floor(p);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = id0 + vec2(float(i), float(j));
    vec3 h = hash32(id + SEEDV);
    vec2 d = rot(h.z * TAU) * (p - id - 0.5 - (h.xy - 0.5) * 0.9);
    vec2 sz = vec2(0.42, 0.14) * (0.5 + h.x) * p_size * 0.01;
    float e = max(abs(d.x) - sz.x, abs(d.y) - sz.y);
    vec3 cc = hueRotate(p_a, floor(h.y * 6.0) * 1.0472 * p_hues * 0.01);
    col = mix(col, vec4(cc, 1.0), 1.0 - smoothstep(-uAA, uAA, e));
  }
  return col;
}`,
  },
  {
    id: 'seigaiha',
    name: 'Seigaiha',
    params: [DENSITY(7), R('rings', 'Rings', 1, 6, 3), A('#27496d'), B('#f0f5f9'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float j = floor(p.y * 2.0);
  float r = 1.0;
  for (int k = 0; k < 2; k++) {
    float row = j + float(k);
    float x = p.x + mod(row, 2.0) * 0.5;
    vec2 c = vec2(floor(x) + 0.5, row * 0.5);
    float d = length(vec2(x, p.y) - c) * 2.0;
    if (d < 1.0) { r = d; break; }
  }
  float n = floor(p_rings + 0.5);
  float band = abs(fract(r * n) - 0.5);
  float aa = uAA * 2.0 * n;
  return two(1.0 - smoothstep(0.25 - aa, 0.25 + aa, band));
}`,
  },
  {
    id: 'truchet',
    fixed: ['width'],
    name: 'Truchet',
    seeded: true,
    params: [DENSITY(10), R('width', 'Line width', 2, 45, 16), O('style', 'Style', ['Arcs', 'Maze'], 0), A('#22223b'), B('#f2e9e4'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  vec2 f = fract(p);
  if (hash21(floor(p) + SEEDV) < 0.5) f.x = 1.0 - f.x;
  float d = p_style < 0.5
    ? min(abs(length(f) - 0.5), abs(length(f - 1.0) - 0.5))
    : min(abs(f.x - f.y), min(abs(f.x - f.y + 1.0), abs(f.x - f.y - 1.0))) * 0.7071;
  float w = p_width * 0.005;
  return two(1.0 - smoothstep(w - uAA, w + uAA, d));
}`,
  },
  {
    id: 'topo',
    name: 'Contours',
    seeded: true,
    params: [DENSITY(5), R('levels', 'Levels', 2, 30, 12), R('width', 'Line width', 5, 100, 35), A('#2f4858'), B('#f6f4e8'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float n = fbm(p * 0.5 + SEEDV) * p_levels;
  float d = abs(fract(n) - 0.5) / max(fwidth(n), 1e-5);
  float w = p_width * 0.0004 / uAA;
  return two(1.0 - smoothstep(w - 0.7, w + 0.7, d));
}`,
  },
  {
    id: 'camo',
    name: 'Camo',
    seeded: true,
    params: [DENSITY(5), A('#4a5d23'), B('#c2b280'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float n = fbm(p * 0.7 + SEEDV);
  float m = fbm(p * 0.7 + SEEDV + 31.0);
  float aa = uAA * 0.8;
  vec4 col = two(smoothstep(0.47 - aa, 0.47 + aa, n));
  col = mix(col, vec4(p_a * 0.45, 1.0), smoothstep(0.56 - aa, 0.56 + aa, m));
  col = mix(col, vec4(mix(p_b, p_a, 0.5), 1.0), smoothstep(0.6 - aa, 0.6 + aa, n) * 0.9);
  return col;
}`,
  },
  {
    id: 'plaid',
    name: 'Plaid',
    params: [DENSITY(6), A('#9b2226'), B('#f1e3c8'), BG(0)],
    frag: `
float plaidBand(float x) {
  float f = fract(x);
  float wide = 1.0 - smoothstep(0.24 - uAA, 0.24 + uAA, abs(f - 0.5));
  float thin = 1.0 - smoothstep(0.03 - uAA, 0.03 + uAA, abs(fract(x + 0.5) - 0.5));
  return max(wide * 0.55, thin * 0.9);
}
vec4 pattern(vec2 p) {
  float tx = plaidBand(p.x), ty = plaidBand(p.y);
  float t = 1.0 - (1.0 - tx) * (1.0 - ty);
  vec4 col = two(t);
  col.rgb *= 1.0 - 0.35 * tx * ty;
  return col;
}`,
  },
  {
    id: 'triangles',
    name: 'Triangles',
    seeded: true,
    params: [DENSITY(9), R('variety', 'Tone variety', 0, 100, 60), A('#3d5a80'), B('#e0fbfc'), BG(0)],
    frag: `
vec4 triangle(vec2 p) {
  vec2 i = floor(p + (p.x + p.y) * 0.366025404);
  vec2 a = p - i + (i.x + i.y) * 0.211324865;
  float up = step(a.y, a.x);
  float h = hash21(i * 2.0 + up + SEEDV);
  vec4 col = two(up);
  col.rgb *= 1.0 - (h - 0.5) * p_variety * 0.008 * col.a;
  return col;
}
// Every triangle has its own shade, so the edges are smoothed by averaging four samples per pixel.
vec4 pattern(vec2 p) {
  return 0.25 * (triangle(p + vec2(0.125, 0.375) * uAA) + triangle(p + vec2(-0.375, 0.125) * uAA)
    + triangle(p + vec2(-0.125, -0.375) * uAA) + triangle(p + vec2(0.375, -0.125) * uAA));
}`,
  },
  {
    id: 'sunburst',
    name: 'Sunburst',
    params: [R('rays', 'Rays', 3, 60, 18), R('twist', 'Twist', -100, 100, 0), A('#f77f00'), B('#fcf0d9'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float r = length(p);
  float n = floor(p_rays + 0.5);
  float v = fract((atan(p.y, p.x) / TAU + r * p_twist * 0.002) * n);
  float aa = uAA * n / (TAU * max(r, 1e-4));
  return two(mix(0.5, 1.0 - smoothstep(0.25 - aa, 0.25 + aa, abs(v - 0.5)), smoothstep(0.0, uAA * 4.0, r)));
}`,
  },
  {
    id: 'spiral',
    fixed: ['ratio'],
    name: 'Spiral',
    params: [DENSITY(10), R('arms', 'Arms', 1, 12, 2), R('ratio', 'Band width', 5, 95, 50), A('#e5989b'), B('#fff1e6'), BG(0)],
    frag: `
vec4 pattern(vec2 p) {
  float v = fract(length(p) - atan(p.y, p.x) / TAU * floor(p_arms + 0.5));
  float w = p_ratio * 0.005;
  return two(1.0 - smoothstep(w - uAA, w + uAA, abs(v - 0.5)));
}`,
  },
];

const PATTERN_MAP = new Map(PATTERNS.map((pattern) => [pattern.id, pattern]));

export function getPattern(id) {
  return PATTERN_MAP.get(id) ?? PATTERNS[0];
}

export function hasPattern(id) {
  return PATTERN_MAP.has(id);
}

/**
 * Uniforms for a pattern. Density changes how many repeats there are; the sizes listed in
 * `fixed` (line widths, dot sizes) are compensated so they keep the same size on the picture,
 * otherwise Density would look exactly like zooming out.
 */
export function patternUniforms(definition, params = {}) {
  const densityParam = definition.params.find((param) => param.key === 'density');
  const ratio = densityParam ? (Number(params.density) || densityParam.value) / densityParam.value : 1;
  const scaled = { ...params };

  for (const key of definition.fixed ?? []) {
    const param = definition.params.find((candidate) => candidate.key === key);
    const value = Number(params[key] ?? param.value);

    // Never let compensation close the gaps completely.
    scaled[key] = Math.max(param.min, Math.min(Math.max(value, param.max * 0.8), value * ratio));
  }

  return paramUniforms(definition, scaled);
}

/** GLSL for `layerShader()`: evaluates the pattern in the layer's local box. */
export function patternSource(definition) {
  const uniforms = definition.params
    .map((param) => `uniform ${param.type === 'color' ? 'vec3' : 'float'} p_${param.key};`)
    .join('\n');

  return `
uniform vec2 uPatScale;
uniform float uAA;
uniform float uSeed;
#define SEEDV (vec2(uSeed * 13.37, uSeed * 7.13))
${CELLS}
${uniforms}
vec4 two(float t) {
  float ba = p_bg * 0.01;
  return vec4(p_a * t + p_b * ba * (1.0 - t), t + ba * (1.0 - t));
}
${definition.frag}
vec4 layerColor(vec2 local) { return pattern(local * uPatScale); }`;
}
