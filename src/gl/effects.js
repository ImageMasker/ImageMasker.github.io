// Effect masks: fragment shaders that rework the pixels underneath them instead of covering them.
//
// Every effect defines `vec4 fx(vec2 q)`. `q` is the pixel position in "units" where the short side
// of the document is 1.0, so effects look the same in the low-resolution preview and the full export.
//   S(q)      premultiplied colour of the image below (after the optional blur pre-pass)
//   O(q)      premultiplied colour of the untouched image below
//   uAsp      document size in units, uPx = size of one render pixel in units
//   uCenter   centre of the effect region in units, uExtent = half of its short side
//   uSeed     per-layer random seed, SEEDV the same as a vec2 offset
//   p_<key>   one uniform per parameter (float, or vec3 for colours)

import { HEAD, LIB, CELLS } from './glsl.js';

const R = (key, label, min, max, value, step = 1) => ({ key, label, type: 'range', min, max, value, step });
const C = (key, label, value) => ({ key, label, type: 'color', value });
const T = (key, label, value = false) => ({ key, label, type: 'toggle', value });
const O = (key, label, options, value = 0) => ({ key, label, type: 'select', options, value });

export const EFFECT_CATEGORIES = [
  { id: 'glass', label: 'Glass' },
  { id: 'water', label: 'Water' },
  { id: 'tiles', label: 'Scramble' },
  { id: 'warp', label: 'Warp' },
  { id: 'art', label: 'Print & paint' },
  { id: 'retro', label: 'Glitch & colour' },
  { id: 'basic', label: 'Classic' },
  { id: 'heavy', label: 'Heavy (hard to recognise)' },
];

export const EFFECTS = [
  // ───────────────────────────── Glass ─────────────────────────────
  {
    id: 'cutGlass',
    name: 'Cut glass',
    cat: 'glass',
    strength: 3,
    seeded: true,
    desc: 'Leaded panes that each bend the picture a different way.',
    params: [
      R('size', 'Pane size', 4, 40, 15),
      R('shift', 'Shift', 0, 100, 30),
      R('twist', 'Twist', 0, 100, 20),
      R('zoom', 'Zoom', 0, 100, 25),
      R('bevel', 'Bevel', 0, 100, 55),
      R('lead', 'Lead lines', 0, 100, 40),
      R('texture', 'Surface texture', 0, 100, 35),
      R('dispersion', 'Colour fringes', 0, 100, 30),
      R('gloss', 'Gloss', 0, 100, 50),
      R('tone', 'Tone variation', 0, 100, 15),
      R('tint', 'Pane tint', 0, 100, 0),
      O('palette', 'Tint colours', ['Blue, amber, plum', 'Cool', 'Warm', 'Soft rainbow'], 0),
    ],
    main: ['size', 'shift', 'tint'],
    frag: `
vec3 paneTint(int k, float t) {
  if (k == 1) return mix(vec3(0.55, 0.75, 1.0), vec3(0.6, 1.0, 0.85), t);
  if (k == 2) return mix(vec3(1.0, 0.75, 0.45), vec3(1.0, 0.58, 0.62), t);
  if (k == 3) return hsv2rgb(vec3(t, 0.45, 1.0));
  return t < 0.34 ? vec3(0.55, 0.72, 1.0) : t < 0.67 ? vec3(1.0, 0.8, 0.45) : vec3(0.86, 0.6, 0.95);
}
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  Vor v = voronoi(q / cs, 0.85);
  vec2 c = v.center * cs;
  vec3 h = hash32(v.id + SEEDV + 3.1);
  vec2 p = q - c;
  p = rot((h.z - 0.5) * p_twist * 0.012) * p;
  p *= 1.0 + (h.x - 0.5) * p_zoom * 0.012;
  vec2 off = (hash22(v.id + SEEDV + 9.7) - 0.5) * cs * p_shift * 0.016;
  float e = v.edge * cs;
  float bev = 1.0 - smoothstep(0.0, cs * 0.22, e);
  // Each pane is tilted a little, has a bevelled rim and the uneven surface of hand-made glass.
  vec2 tilt = (hash22(v.id + SEEDV + 5.3) - 0.5) * 0.6;
  vec2 grain = glassSlope(q * 45.0 + h.xy * 30.0, 2) * p_texture * 0.012;
  vec2 bevel = -v.n * bev * bev * p_bevel * 0.03;
  vec4 col = refractS(c + p + off, grain * 0.012 + bevel * cs * 0.13 + tilt * cs * 0.04, p_dispersion * 0.006);
  float tone = (h.y - 0.5) * p_tone * 0.008;
  col.rgb = mix(col.rgb, vec3(luma(col.rgb)), clamp(abs(tone) * 1.5, 0.0, 1.0)) * (1.0 + tone);
  vec3 pane = paneTint(int(p_palette + 0.5), hash21(v.id + SEEDV + 1.7));
  col.rgb = mix(col.rgb, col.rgb * pane * 1.2 + pane * 0.05 * col.a, p_tint * 0.01);
  vec2 lt = glassLight(tilt * 0.6 + grain + bevel, 70.0);
  float gl = p_gloss * 0.01;
  col.rgb *= 1.0 + lt.x * 0.4 * gl;
  col.rgb += col.a * lt.y * 0.45 * gl;
  float lw = p_lead * 0.00012;
  float aa = uPx * 1.5;
  float line = (1.0 - smoothstep(lw - aa, lw + aa, e)) * step(0.5, p_lead);
  float glint = (1.0 - smoothstep(lw * 0.25, lw * 0.6 + aa, abs(e - lw * 0.55))) * max(dot(v.n, vec2(0.6, 0.8)), 0.0);
  col.rgb = mix(col.rgb, vec3(0.17, 0.21, 0.23) * col.a, line);
  col.rgb = mix(col.rgb, vec3(0.92, 0.95, 0.93) * col.a, glint * line * 0.75);
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'stainedGlass',
    name: 'Stained glass',
    cat: 'glass',
    strength: 2,
    seeded: true,
    desc: 'Lightly tinted, rippled panes held together by dark leading.',
    params: [
      R('size', 'Pane size', 2, 40, 11),
      R('flatten', 'Flatten', 0, 100, 20),
      R('tint', 'Tint', 0, 100, 18),
      R('glow', 'Glow', 0, 100, 20),
      R('lead', 'Lead lines', 0, 100, 30),
      R('texture', 'Surface texture', 0, 100, 45),
      R('gloss', 'Gloss', 0, 100, 40),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  Vor v = voronoi(q / cs, 0.9);
  vec2 c = v.center * cs;
  vec3 h = hash32(v.id + SEEDV);
  vec2 grain = glassSlope(q * 30.0 + h.xy * 50.0, 3) * p_texture * 0.012;
  float k = cs * 0.2;
  vec4 avg = (S(c) * 2.0 + S(c + vec2(k, 0.0)) + S(c - vec2(k, 0.0)) + S(c + vec2(0.0, k)) + S(c - vec2(0.0, k))) / 6.0;
  vec4 col = mix(S(q + grain * 0.012), avg, p_flatten * 0.01);
  vec3 tintc = hsv2rgb(vec3(h.x, 0.6, 1.0));
  col.rgb = mix(col.rgb, col.rgb * tintc * 1.3 + tintc * 0.06 * col.a, p_tint * 0.01);
  float e = v.edge * cs;
  col.rgb *= mix(1.0, 0.7 + 0.45 * smoothstep(0.0, cs * 0.35, e), p_glow * 0.01);
  vec2 lt = glassLight(grain + (h.yz - 0.5) * 0.5, 40.0);
  float gl = p_gloss * 0.01;
  col.rgb *= 1.0 + lt.x * 0.4 * gl;
  col.rgb += col.a * lt.y * 0.6 * gl;
  float lw = p_lead * 0.00012;
  float aa = uPx * 1.5;
  float line = (1.0 - smoothstep(lw - aa, lw + aa, e)) * step(0.5, p_lead);
  col.rgb = mix(col.rgb, vec3(0.06, 0.06, 0.08) * col.a, line);
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'flutedGlass',
    thumb: { width: 6 },
    name: 'Reeded glass',
    cat: 'glass',
    strength: 2,
    centered: true,
    desc: 'Vertical flutes that squeeze, mirror and catch the light.',
    params: [
      R('width', 'Flute width', 0.5, 20, 3, 0.1),
      R('strength', 'Refraction', 0, 100, 45),
      R('angle', 'Angle', 0, 180, 0),
      R('dispersion', 'Colour fringes', 0, 100, 30),
      R('gloss', 'Gloss', 0, 100, 50),
    ],
    frag: `
vec4 fx(vec2 q) {
  mat2 m = rot(radians(p_angle));
  mat2 mt = transpose(m);
  vec2 p = m * (q - uCenter);
  float w = p_width * 0.01;
  float i = floor(p.x / w);
  float f = fract(p.x / w) - 0.5;
  float k = mix(1.0, -3.2, p_strength * 0.01);
  float bend = f * (1.0 + 2.0 * f * f) * k;
  // Drawn glass is never perfectly straight: every flute wanders a little along its length.
  float wob = (vnoise(vec2(i * 7.3, p.y * 5.0)) - 0.5) * 0.25 * p_strength * 0.01;
  vec2 origin = mt * vec2((i + 0.5) * w, p.y) + uCenter;
  vec2 ax = mt * vec2(w, 0.0);
  float d = p_dispersion * 0.004;
  vec4 col = S(origin + ax * (bend + wob));
  if (d > 0.002) {
    col.r = S(origin + ax * (bend * (1.0 - d) + wob)).r;
    col.b = S(origin + ax * (bend * (1.0 + d) + wob)).b;
  }
  vec2 lt = glassLight(mt * vec2(-f * 2.4 + wob * 2.0, 0.0), 30.0);
  float gl = p_gloss * 0.01;
  col.rgb *= 1.0 + lt.x * 0.5 * gl;
  col.rgb *= 1.0 - 0.35 * gl * smoothstep(0.38, 0.5, abs(f));
  col.rgb += col.a * lt.y * 0.55 * gl;
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'glassBlocks',
    name: 'Glass blocks',
    cat: 'glass',
    strength: 3,
    seeded: true,
    desc: 'A wall of thick, wavy glass bricks, each one its own lens.',
    params: [
      R('size', 'Block size', 2, 40, 10),
      R('lens', 'Lens', 0, 100, 35),
      R('jitter', 'Jitter', 0, 100, 15),
      R('mortar', 'Mortar', 0, 100, 35),
      R('texture', 'Surface texture', 0, 100, 40),
      R('dispersion', 'Colour fringes', 0, 100, 30),
      R('gloss', 'Gloss', 0, 100, 45),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec2 g = q / cs;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec2 h = hash22(id + SEEDV);
  float t = p_lens * 0.01;
  vec2 wav = glassSlope(g * 1.6 + h * 20.0, 2) * p_texture * 0.01;
  vec2 d = f * mix(1.0, 3.0, t) * (1.0 + 0.9 * dot(f, f)) + wav * 0.07;
  vec4 col = refractS((id + 0.5 + (h - 0.5) * p_jitter * 0.012) * cs, d * cs, p_dispersion * 0.003);
  vec2 lt = glassLight(wav - f * 1.6 * t, 60.0);
  float gl = p_gloss * 0.01;
  col.rgb *= 1.0 + lt.x * 0.4 * gl;
  col.rgb += col.a * lt.y * 0.4 * gl;
  float e = 0.5 - max(abs(f.x), abs(f.y));
  float mw = p_mortar * 0.0012;
  float aa = uPx / cs * 1.5;
  float line = (1.0 - smoothstep(mw - aa, mw + aa, e)) * step(0.5, p_mortar);
  float rim = 1.0 - smoothstep(mw, mw + 0.09, e);
  col.rgb += col.a * rim * (f.x + f.y < 0.0 ? 0.22 : -0.16);
  col.rgb = mix(col.rgb, vec3(0.84, 0.86, 0.87) * col.a, line);
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'frosted',
    thumb: { amount: 95, grain: 70 },
    name: 'Frosted glass',
    cat: 'glass',
    strength: 2,
    seeded: true,
    desc: 'Grainy privacy glass that scatters every pixel and sparkles a little.',
    blur: (p) => p.amount * 0.00003,
    params: [
      R('amount', 'Amount', 0, 100, 45),
      R('grain', 'Grain size', 0, 100, 35),
      R('sparkle', 'Sparkle', 0, 100, 25),
    ],
    frag: `
vec4 fx(vec2 q) {
  float sc = mix(700.0, 30.0, p_grain * 0.01);
  vec2 n = noise2(q * sc + SEEDV) - 0.5;
  vec2 n2 = hash22(floor(q / uPx) + SEEDV) - 0.5;
  vec4 col = S(q + (n * 0.8 + n2 * 0.45) * p_amount * 0.0009);
  col.rgb *= 1.0 + n.x * 0.12;
  col.rgb += col.a * pow(hash21(floor(q * 900.0) + SEEDV + 3.0), 40.0) * p_sparkle * 0.006;
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'privacyGlass',
    thumb: { scale: 9 },
    name: 'Textured glass',
    cat: 'glass',
    strength: 2,
    seeded: true,
    desc: 'Patterned window glass: hammered, pebbled, hand-blown, rippled or seedy.',
    params: [
      O('pattern', 'Pattern', ['Hammered', 'Pebbled', 'Flemish', 'Rippled', 'Seedy'], 0),
      R('scale', 'Pattern size', 1, 30, 4, 0.5),
      R('depth', 'Depth', 0, 100, 45),
      R('dispersion', 'Colour fringes', 0, 100, 30),
      R('gloss', 'Gloss', 0, 100, 50),
      R('tint', 'Bottle tint', 0, 100, 15),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_scale * 0.01;
  vec2 slope = glassSlope(q / cs, int(p_pattern + 0.5)) * p_depth * 0.02;
  vec4 col = refractS(q, slope * cs * 0.22, p_dispersion * 0.006);
  vec2 lt = glassLight(slope, 60.0);
  float gl = p_gloss * 0.01;
  col.rgb *= 1.0 + lt.x * 0.45 * gl;
  col.rgb += col.a * lt.y * 0.45 * gl;
  col.rgb = mix(col.rgb, col.rgb * vec3(0.86, 0.97, 0.93), p_tint * 0.01);
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'rain',
    name: 'Rainy window',
    cat: 'water',
    strength: 2,
    seeded: true,
    desc: 'A misted pane with droplets that flip the view and runs that wipe it clear.',
    blur: (p) => 0.0008 + p.fog * 0.00022,
    params: [
      R('density', 'Drops', 0, 100, 60),
      R('size', 'Drop size', 10, 100, 50),
      R('fog', 'Fog', 0, 100, 30),
      R('trails', 'Running drops', 0, 100, 40),
    ],
    frag: `
// One droplet: a small dome that shows the scene upside down, with a highlight and a dark rim.
void drop(inout vec4 col, vec2 q, vec2 d, float r) {
  float dist = length(d) / r;
  if (dist >= 1.0) return;
  vec2 nrm = d / r;
  float hz = sqrt(max(1.0 - dist * dist, 0.0));
  vec4 lens = O(q - nrm * r * (2.2 + 1.6 * dist * dist));
  vec2 lt = glassLight(-nrm / max(hz, 0.35) * 0.9, 70.0);
  lens.rgb *= 1.0 - 0.5 * smoothstep(0.55, 1.0, dist);
  lens.rgb += lens.a * 0.3 * smoothstep(0.45, 0.95, dist) * max(dot(nrm / max(dist, 1e-4), vec2(0.62, 0.78)), 0.0);
  lens.rgb += lens.a * lt.y * 0.9;
  col = mix(col, lens, 1.0 - smoothstep(0.9, 1.0, dist));
}
vec4 fx(vec2 q) {
  vec4 col = S(q);
  col.rgb = mix(col.rgb, col.rgb * 0.86 + 0.09 * col.a, p_fog * 0.01);
  float sz = 0.4 + p_size * 0.012;
  // Drops that ran down the glass leave a clear, slightly wavy track behind them.
  float lw = 0.085 * sz;
  float lane = floor(q.x / lw);
  vec3 lh = hash32(vec2(lane, 7.7) + SEEDV);
  if (lh.x < p_trails * 0.006) {
    float cx = (lane + 0.5 + (lh.y - 0.5) * 0.4) * lw + sin(q.y * 23.0 + lh.z * TAU) * lw * 0.07;
    float headY = (0.25 + 0.7 * lh.z) * uAsp.y;
    float dx = q.x - cx;
    float tw = lw * 0.11 * (0.55 + 0.45 * smoothstep(0.0, headY, q.y));
    if (q.y < headY) {
      float t = 1.0 - smoothstep(tw * 0.55, tw, abs(dx));
      col = mix(col, O(q + vec2(dx * 1.4, 0.0)), t * 0.85);
      col.rgb *= 1.0 - 0.1 * t * smoothstep(tw * 0.3, tw, abs(dx));
    }
    drop(col, q, vec2(dx, (q.y - headY) * 0.72), lw * 0.2);
  }
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float cs = (0.11 - 0.03 * fl) * sz;
    vec2 g = q / cs + fl * 17.3 + SEEDV;
    vec2 id = floor(g);
    vec3 h = hash32(id + fl * 7.7);
    if (h.z > p_density * 0.01) continue;
    vec2 d = fract(g) - 0.5 - (h.xy - 0.5) * 0.5;
    d.y *= 0.82;
    drop(col, q, d * cs, cs * (0.13 + 0.2 * hash21(id + 3.3 + fl)));
  }
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'ripple',
    name: 'Pond ripples',
    cat: 'water',
    strength: 2,
    seeded: true,
    desc: 'Rings spreading from a few raindrops on still water.',
    params: [
      R('scale', 'Wavelength', 1, 30, 6, 0.5),
      R('amount', 'Amount', 0, 100, 45),
      R('drops', 'Drops', 1, 8, 4),
      R('shine', 'Shine', 0, 100, 45),
      R('dispersion', 'Colour fringes', 0, 100, 20),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec2 slope = vec2(0.0);
  float hgt = 0.0;
  float w = p_scale * 0.01;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= p_drops) break;
    vec2 c = hash22(vec2(float(i) * 3.7 + 1.3, 5.1) + SEEDV) * uAsp;
    vec2 v = q - c;
    float r = length(v) + 1e-4;
    float ph = r / w * TAU;
    float att = 1.0 / (1.0 + r * 2.5);
    slope += (v / r) * cos(ph) * att;
    hgt += sin(ph) * att;
  }
  vec4 col = refractS(q, slope * p_amount * 0.0004 * (0.4 + p_scale * 0.1), p_dispersion * 0.006);
  vec2 lt = glassLight(slope * 0.3, 60.0);
  float sh = p_shine * 0.01;
  col.rgb *= 1.0 + lt.x * 0.7 * sh;
  col.rgb += col.a * lt.y * 0.35 * sh;
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'water',
    name: 'Water surface',
    cat: 'water',
    strength: 2,
    seeded: true,
    desc: 'Seen through shallow, moving water with caustics and glints.',
    params: [
      R('scale', 'Wave size', 2, 40, 10),
      R('amount', 'Refraction', 0, 100, 40),
      R('caustics', 'Caustics', 0, 100, 40),
      R('glints', 'Glints', 0, 100, 35),
      R('tint', 'Water tint', 0, 100, 25),
      R('dispersion', 'Colour fringes', 0, 100, 15),
    ],
    frag: `
float waterH(vec2 p) {
  vec2 w = p + (noise2(p * 0.35 + SEEDV) - 0.5) * 1.8;
  float h = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    float ang = float(i) * 1.9 + uSeed;
    h += a * sin(dot(w, vec2(cos(ang), sin(ang))) * (2.0 + float(i) * 1.5) + float(i) * 1.3);
    a *= 0.6;
  }
  return h;
}
vec4 fx(vec2 q) {
  float cs = p_scale * 0.01;
  vec2 p = q / cs * 2.0;
  const float e = 0.06;
  float h0 = waterH(p);
  float hx1 = waterH(p + vec2(e, 0.0)), hx0 = waterH(p - vec2(e, 0.0));
  float hy1 = waterH(p + vec2(0.0, e)), hy0 = waterH(p - vec2(0.0, e));
  vec2 slope = vec2(hx1 - hx0, hy1 - hy0) / (2.0 * e);
  float lap = (hx1 + hx0 + hy1 + hy0 - 4.0 * h0) / (e * e);
  vec4 col = refractS(q, slope * cs * p_amount * 0.0024, p_dispersion * 0.006);
  col.rgb = mix(col.rgb, col.rgb * vec3(0.72, 0.93, 1.0) + vec3(0.0, 0.025, 0.045) * col.a, p_tint * 0.01);
  // Wave crests act as lenses and gather the light into bright lines.
  float ca = smoothstep(5.0, 24.0, -lap);
  col.rgb *= 1.0 + (ca * 0.9 - 0.1) * p_caustics * 0.01;
  col.rgb += col.a * ca * 0.08 * p_caustics * 0.01;
  col.rgb += col.a * glassLight(slope * 0.2, 80.0).y * p_glints * 0.008;
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    cat: 'water',
    strength: 3,
    desc: 'A honeycomb of little fisheye lenses.',
    params: [
      R('size', 'Bubble size', 2, 40, 9),
      R('bulge', 'Bulge', 0, 100, 55),
      R('gap', 'Gaps', 0, 100, 30),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec4 hx = hexCell(q / cs);
  vec2 f = hx.xy;
  vec2 c = q / cs - f;
  float r = length(f) * 2.0;
  float rr = min(r, 1.0);
  float k = mix(1.0, 0.2 + 2.0 * rr * rr, p_bulge * 0.01);
  vec4 col = S((c + f * k) * cs);
  float aa = uPx / cs * 3.0;
  float inside = 1.0 - smoothstep(0.92 - aa, 0.92 + aa, r);
  col.rgb *= 1.0 - 0.35 * smoothstep(0.55, 0.95, r) * inside;
  col.rgb += col.a * 0.5 * inside * (1.0 - smoothstep(0.0, 0.28, length(f * 2.0 - vec2(-0.38, -0.42))));
  vec4 gapc = S(q);
  gapc.rgb *= 1.0 - p_gap * 0.008;
  return clamp(mix(gapc, col, inside), 0.0, 1.0);
}`,
  },
  {
    id: 'prism',
    name: 'Prism shards',
    cat: 'glass',
    strength: 2,
    seeded: true,
    desc: 'Crystal facets that split the colours apart.',
    params: [
      R('size', 'Facet size', 4, 60, 24),
      R('spread', 'Colour split', 0, 100, 30),
      R('shift', 'Shift', 0, 100, 12),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  Vor v = voronoi(q / cs, 1.0);
  vec2 h = hash22(v.id + SEEDV);
  float a = h.x * TAU;
  vec2 dir = vec2(cos(a), sin(a));
  float s = p_spread * 0.0005 * (0.4 + h.y);
  vec2 base = q + dir * cs * p_shift * 0.004;
  vec4 c0 = S(base - dir * s), c1 = S(base), c2 = S(base + dir * s);
  vec4 col = vec4(c0.r, c1.g, c2.b, (c0.a + c1.a + c2.a) / 3.0);
  col.rgb *= 1.0 + (h.y - 0.5) * 0.3;
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'crystal',
    thumb: { size: 9 },
    name: 'Crystallize',
    cat: 'glass',
    strength: 2,
    seeded: true,
    desc: 'Solid-colour crystals with faceted shading.',
    params: [
      R('size', 'Crystal size', 0.5, 30, 2.5, 0.5),
      R('facet', 'Facet shading', 0, 100, 45),
      R('edge', 'Edges', 0, 100, 25),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  Vor v = voronoi(q / cs, 1.0);
  vec4 col = S(v.center * cs);
  float a = hash21(v.id + SEEDV) * TAU;
  col.rgb *= 1.0 + dot(q / cs - v.center, vec2(cos(a), sin(a))) * p_facet * 0.012;
  float lw = p_edge * 0.00005;
  float aa = uPx * 1.2;
  col.rgb *= 1.0 - 0.6 * (1.0 - smoothstep(lw - aa, lw + aa, v.edge * cs)) * step(0.5, p_edge);
  return clamp(col, 0.0, 1.0);
}`,
  },

  // ───────────────────────────── Scramble ─────────────────────────────
  {
    id: 'puzzle',
    name: 'Jigsaw',
    cat: 'tiles',
    strength: 3,
    seeded: true,
    desc: 'Interlocking pieces that never quite line up.',
    params: [
      R('size', 'Piece size', 4, 40, 13),
      R('shift', 'Shift', 0, 100, 25),
      R('twist', 'Twist', 0, 100, 10),
      R('depth', 'Emboss', 0, 100, 60),
    ],
    frag: `
vec2 jig(vec2 g, out float d) {
  const float KR = 0.14;
  vec2 id = floor(g), f = fract(g), pid = id;
  d = 1.0;
  for (int k = 0; k < 4; k++) {
    bool vert = k < 2;
    bool far = (k == 1 || k == 3);
    vec2 nrm = vert ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 tang = vert ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
    vec2 eid = id + (far ? nrm : vec2(0.0)) + (vert ? vec2(0.0) : vec2(57.3, 91.1));
    vec2 mid = 0.5 * tang + (far ? nrm : vec2(0.0));
    float s = hash21(eid + SEEDV) < 0.5 ? -1.0 : 1.0;
    float jit = (hash21(eid * 1.7 + SEEDV + 4.2) - 0.5) * 0.18;
    float cd = length(f - (mid + tang * jit + nrm * s * KR * 0.72)) - KR;
    float side = dot(f - mid, nrm);
    float along = abs(dot(f - mid, tang) - jit);
    if (((s > 0.0) != far) && cd < 0.0) pid = id + (far ? nrm : -nrm);
    d = min(d, along < KR * 0.69 ? 1.0 : abs(side));
    if (side * s > 0.0) d = min(d, abs(cd));
  }
  return pid;
}
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec2 g = q / cs;
  float d0, dx, dy;
  vec2 pid = jig(g, d0);
  jig(g + vec2(0.012, 0.0), dx);
  jig(g + vec2(0.0, 0.012), dy);
  vec3 h = hash32(pid + SEEDV + 1.9);
  vec2 p = rot((h.z - 0.5) * p_twist * 0.012) * (g - pid - 0.5);
  vec4 col = S((pid + 0.5 + p + (h.xy - 0.5) * p_shift * 0.014) * cs);
  vec2 grad = vec2(dx - d0, dy - d0);
  float lit = length(grad) > 1e-5 ? dot(normalize(grad), vec2(0.7071)) : 0.0;
  float bev = 1.0 - smoothstep(0.0, 0.07, d0);
  col.rgb *= 1.0 + lit * bev * p_depth * 0.007;
  float lw = 0.012;
  float aa = uPx / cs * 1.5;
  col.rgb *= 1.0 - (1.0 - smoothstep(lw - aa, lw + aa, d0)) * p_depth * 0.008;
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'mosaic',
    name: 'Shuffled tiles',
    cat: 'tiles',
    strength: 3,
    seeded: true,
    desc: 'Square tiles nudged, spun and flipped out of place.',
    params: [
      R('size', 'Tile size', 2, 40, 12),
      R('shift', 'Shift', 0, 100, 20),
      R('twist', 'Twist', 0, 100, 10),
      R('flip', 'Flipped tiles', 0, 100, 0),
      R('gap', 'Grout', 0, 100, 30),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec2 g = q / cs;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec3 h = hash32(id + SEEDV);
  vec2 p = f;
  if (h.z < p_flip * 0.01) { if (h.x < 0.5) p.x = -p.x; else p.y = -p.y; }
  p = rot((h.y - 0.5) * p_twist * 0.02) * p;
  vec2 off = (hash22(id + SEEDV + 5.5) - 0.5) * p_shift * 0.02;
  vec4 col = S((id + 0.5 + p + off) * cs);
  float e = 0.5 - max(abs(f.x), abs(f.y));
  float gw = p_gap * 0.001;
  float aa = uPx / cs * 1.5;
  float line = (1.0 - smoothstep(gw - aa, gw + aa, e)) * step(0.5, p_gap);
  float rim = (1.0 - smoothstep(gw, gw + 0.07, e)) * step(0.5, p_gap);
  col.rgb *= 1.0 + rim * (f.x + f.y < 0.0 ? 0.22 : -0.25);
  col.rgb = mix(col.rgb, vec3(0.1) * col.a, line);
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'hexFlip',
    name: 'Hex mirrors',
    cat: 'tiles',
    strength: 3,
    seeded: true,
    desc: 'Hexagonal mirrors turned and flipped at random.',
    params: [
      R('size', 'Tile size', 3, 40, 13),
      R('turn', 'Turned tiles', 0, 100, 25),
      R('flip', 'Flipped tiles', 0, 100, 15),
      R('gap', 'Edges', 0, 100, 30),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec4 hx = hexCell(q / cs);
  vec2 f = hx.xy;
  vec3 h = hash32(hx.zw * 3.1 + SEEDV);
  vec2 p = f;
  if (h.x < p_flip * 0.01) p.x = -p.x;
  if (h.y < p_turn * 0.01) p = rot((floor(h.z * 5.0) + 1.0) * PI / 3.0) * p;
  vec4 col = S((q / cs - f + p) * cs);
  float e = hexEdge(f);
  float gw = p_gap * 0.0006;
  float aa = uPx / cs * 1.5;
  col.rgb *= 1.0 + (1.0 - smoothstep(gw, gw + 0.08, e)) * step(0.5, p_gap) * (f.x + f.y < 0.0 ? 0.18 : -0.22);
  col.rgb = mix(col.rgb, vec3(0.08) * col.a, (1.0 - smoothstep(gw - aa, gw + aa, e)) * step(0.5, p_gap));
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'shatter',
    name: 'Shattered',
    cat: 'tiles',
    strength: 3,
    seeded: true,
    centered: true,
    desc: 'Cracks radiating from an impact, shards knocked loose.',
    params: [
      R('shards', 'Shards', 4, 40, 15),
      R('rings', 'Rings', 1, 10, 4),
      R('shift', 'Displacement', 0, 100, 30),
      R('crack', 'Cracks', 0, 100, 45),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec2 v = q - uCenter;
  float r = length(v);
  float n = floor(p_shards + 0.5);
  float sa = (atan(v.y, v.x) + PI) / TAU * n + (vnoise(vec2(r * 7.0, 3.0) + SEEDV) - 0.5) * 0.6;
  float si = mod(floor(sa) + n, n);
  float sf = fract(sa);
  float rk = p_rings * 1.7;
  float rr = r * rk + hash11(si * 1.31 + uSeed) * 0.9;
  float ri = floor(rr);
  float rf = fract(rr);
  vec3 h = hash32(vec2(si, ri) * 1.7 + SEEDV);
  vec2 off = (h.xy - 0.5) * p_shift * 0.0016 * (0.4 + r * 2.0);
  vec4 col = S(uCenter + rot((h.z - 0.5) * p_shift * 0.004) * v + off);
  col.rgb *= 1.0 + (h.y - 0.5) * 0.2;
  float d = min(min(sf, 1.0 - sf) * (TAU / n) * r, min(rf, 1.0 - rf) / rk);
  float lw = p_crack * 0.00004;
  float aa = uPx * 1.2;
  col.rgb += col.a * (1.0 - smoothstep(lw, lw * 5.0 + 0.004, d)) * (h.x - 0.35) * 0.4 * step(0.5, p_crack);
  col.rgb = mix(col.rgb, vec3(0.94, 0.97, 1.0) * col.a, (1.0 - smoothstep(lw - aa, lw + aa, d)) * 0.85 * step(0.5, p_crack));
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'weave',
    name: 'Woven strips',
    cat: 'tiles',
    strength: 2,
    seeded: true,
    desc: 'The picture cut into ribbons and woven back together.',
    params: [
      R('width', 'Strip width', 1, 30, 7, 0.5),
      R('shift', 'Shift', 0, 100, 25),
      R('shadow', 'Shadow', 0, 100, 60),
      R('gap', 'Gaps', 0, 100, 20),
    ],
    frag: `
vec4 fx(vec2 q) {
  float w = p_width * 0.01;
  vec2 g = q / w;
  vec2 id = floor(g);
  vec2 f = fract(g);
  bool hTop = mod(id.x + id.y, 2.0) < 0.5;
  float offH = (hash11(id.y * 1.31 + uSeed) - 0.5) * p_shift * 0.004;
  float offV = (hash11(id.x * 1.73 + uSeed + 50.0) - 0.5) * p_shift * 0.004;
  vec4 col = S(hTop ? q + vec2(offH, 0.0) : q + vec2(0.0, offV));
  float along = hTop ? f.x : f.y;
  float across = hTop ? f.y : f.x;
  col.rgb *= 1.0 - p_shadow * 0.006 * pow(abs(along - 0.5) * 2.0, 3.0);
  float e = min(across, 1.0 - across);
  float gw = p_gap * 0.002;
  float aa = uPx / w * 1.5;
  col.rgb *= 1.0 - 0.8 * (1.0 - smoothstep(gw - aa, gw + aa, e)) * step(0.5, p_gap);
  col.rgb *= hTop ? 1.04 : 0.93;
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'slats',
    name: 'Sliding slats',
    cat: 'tiles',
    strength: 2,
    seeded: true,
    centered: true,
    desc: 'Strips slid sideways like a broken blind.',
    params: [
      R('width', 'Slat width', 0.5, 30, 5, 0.5),
      R('shift', 'Shift', 0, 100, 25),
      R('angle', 'Angle', 0, 180, 0),
      T('mirror', 'Flip every other slat', false),
      R('edge', 'Edge shading', 0, 100, 40),
    ],
    frag: `
vec4 fx(vec2 q) {
  mat2 m = rot(radians(p_angle));
  vec2 p = m * (q - uCenter);
  float w = p_width * 0.01;
  float i = floor(p.y / w);
  float f = fract(p.y / w);
  p.x += (hash11(i * 1.37 + uSeed) - 0.5) * p_shift * 0.006;
  if (p_mirror > 0.5 && mod(i, 2.0) > 0.5) p.y = (i + 1.0 - f) * w;
  vec4 col = S(transpose(m) * p + uCenter);
  col.rgb *= 1.0 - p_edge * 0.006 * (1.0 - smoothstep(0.0, 0.14, min(f, 1.0 - f)));
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'rings',
    name: 'Turning rings',
    cat: 'tiles',
    strength: 3,
    seeded: true,
    centered: true,
    desc: 'Concentric rings, each rotated by a different amount.',
    params: [
      R('width', 'Ring width', 1, 30, 7, 0.5),
      R('twist', 'Max rotation', 0, 180, 14),
      R('edge', 'Edge shading', 0, 100, 45),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec2 v = q - uCenter;
  float w = p_width * 0.01;
  float r = length(v) / w;
  float a = (hash11(floor(r) * 2.17 + uSeed) - 0.5) * 2.0 * radians(p_twist);
  vec4 col = S(uCenter + rot(a) * v);
  float f = fract(r);
  col.rgb *= 1.0 - p_edge * 0.007 * (1.0 - smoothstep(0.0, 0.1, min(f, 1.0 - f)));
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'paperFold',
    name: 'Paper folds',
    cat: 'tiles',
    strength: 2,
    centered: true,
    desc: 'A print folded into an accordion of shaded panels.',
    params: [
      R('width', 'Panel width', 1, 40, 9, 0.5),
      R('depth', 'Fold depth', 0, 100, 45),
      R('angle', 'Angle', 0, 180, 0),
    ],
    frag: `
vec4 fx(vec2 q) {
  mat2 m = rot(radians(p_angle));
  vec2 p = m * (q - uCenter);
  float w = p_width * 0.01;
  float i = floor(p.x / w);
  float f = fract(p.x / w);
  float sgn = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
  float d = p_depth * 0.01;
  p.y += sgn * (f - 0.5) * w * d * 0.9;
  p.x = (i + 0.5) * w + (f - 0.5) * w * (1.0 + d * 0.5);
  vec4 col = S(transpose(m) * p + uCenter);
  col.rgb *= 1.0 + d * (sgn > 0.0 ? 0.14 : -0.2) + d * 0.2 * sgn * (0.5 - f);
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'lowPoly',
    thumb: { size: 10 },
    name: 'Low poly',
    cat: 'tiles',
    strength: 2,
    seeded: true,
    desc: 'Flat-shaded triangles, like a paper-craft model.',
    params: [
      R('size', 'Triangle size', 1, 30, 3.5, 0.5),
      R('jitter', 'Irregularity', 0, 100, 60),
      R('edge', 'Edges', 0, 100, 25),
    ],
    frag: `
vec2 unskew(vec2 i) { return i - (i.x + i.y) * 0.211324865; }
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec2 warp = (noise2(q / cs * 0.9 + SEEDV) - 0.5) * p_jitter * 0.012;
  vec2 p = q / cs + warp;
  vec2 i = floor(p + (p.x + p.y) * 0.366025404);
  vec2 a = p - unskew(i);
  vec2 o = a.x > a.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 c0 = unskew(i), c1 = unskew(i + o), c2 = unskew(i + 1.0);
  vec4 col = S(((c0 + c1 + c2) / 3.0 - warp) * cs);
  col.rgb *= 1.0 + (hash21(i * 2.0 + o + SEEDV) - 0.5) * 0.18;
  float area = cross2(c1 - c0, c2 - c0);
  vec3 b = vec3(cross2(c1 - c0, p - c0), cross2(c2 - c1, p - c1), cross2(c0 - c2, p - c2)) / area;
  col.rgb *= 1.0 - p_edge * 0.006 * (1.0 - smoothstep(0.0, 0.07, min(b.x, min(b.y, b.z))));
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'kaleido',
    name: 'Kaleidoscope',
    cat: 'heavy',
    strength: 3,
    centered: true,
    desc: 'Mirrored wedges spinning around the centre.',
    params: [
      R('segments', 'Segments', 2, 24, 8),
      R('angle', 'Rotation', 0, 360, 0),
      R('zoom', 'Zoom', 40, 300, 100),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec2 v = q - uCenter;
  float seg = TAU / floor(p_segments + 0.5);
  float a = atan(v.y, v.x) + radians(p_angle);
  a = abs(mod(a, seg) - seg * 0.5) - radians(p_angle) * 0.5;
  return S(uCenter + vec2(cos(a), sin(a)) * length(v) * 100.0 / p_zoom);
}`,
  },
  {
    id: 'mirrorGrid',
    name: 'Mirror tiles',
    cat: 'heavy',
    strength: 3,
    centered: true,
    desc: 'One patch of the picture repeated as mirrored tiles.',
    params: [
      R('tiles', 'Tiles', 1, 12, 3),
      R('spread', 'Area shown', 5, 100, 45),
    ],
    frag: `
vec4 fx(vec2 q) {
  float n = floor(p_tiles + 0.5);
  vec2 g = (q - uCenter) * n + 0.5;
  vec2 id = floor(g);
  vec2 f = fract(g);
  if (mod(id.x, 2.0) > 0.5) f.x = 1.0 - f.x;
  if (mod(id.y, 2.0) > 0.5) f.y = 1.0 - f.y;
  return S(uCenter + (f - 0.5) * mix(1.0 / n, 1.0, p_spread * 0.01));
}`,
  },

  // ───────────────────────────── Warp ─────────────────────────────
  {
    id: 'liquify',
    name: 'Liquid warp',
    cat: 'warp',
    strength: 2,
    seeded: true,
    desc: 'Smooth, marbled currents pushing the picture around.',
    params: [
      R('scale', 'Scale', 0, 100, 40),
      R('amount', 'Amount', 0, 100, 28),
    ],
    frag: `
vec4 fx(vec2 q) {
  float sc = mix(14.0, 1.2, p_scale * 0.01);
  vec2 n = vec2(fbm(q * sc + SEEDV), fbm(q * sc + SEEDV + vec2(41.3, 17.9))) - 0.48;
  vec2 q2 = (q + n * 0.5) * sc * 1.7 + SEEDV;
  vec2 n2 = vec2(fbm(q2 + 7.1), fbm(q2 + 23.4)) - 0.48;
  return S(q + (n + n2 * 0.6) * p_amount * 0.004);
}`,
  },
  {
    id: 'swirlGrid',
    name: 'Twirl cells',
    cat: 'warp',
    strength: 3,
    desc: 'A grid of small whirlpools.',
    params: [
      R('size', 'Cell size', 3, 60, 16),
      R('angle', 'Twist', 0, 540, 70),
      T('alternate', 'Alternate direction', true),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec2 g = q / cs;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float t = 1.0 - smoothstep(0.0, 1.0, length(f) * 2.0);
  float dirn = (p_alternate > 0.5 && mod(id.x + id.y, 2.0) > 0.5) ? -1.0 : 1.0;
  return S((id + 0.5 + rot(radians(p_angle) * t * dirn) * f) * cs);
}`,
  },
  {
    id: 'wave',
    name: 'Waves',
    cat: 'warp',
    strength: 1,
    seeded: true,
    centered: true,
    desc: 'Rolling sine waves.',
    params: [
      R('length', 'Wavelength', 1, 60, 12),
      R('amount', 'Amount', 0, 100, 25),
      R('angle', 'Angle', 0, 180, 0),
      T('cross', 'Both directions', true),
    ],
    frag: `
vec4 fx(vec2 q) {
  mat2 m = rot(radians(p_angle));
  vec2 p = m * (q - uCenter);
  float w = p_length * 0.01;
  float amp = w * p_amount * 0.004;
  vec2 d = vec2(sin(p.y / w * TAU + uSeed), 0.0) * amp;
  if (p_cross > 0.5) d.y = sin(p.x / w * TAU * 0.83 + uSeed * 1.7) * amp;
  return S(transpose(m) * (p + d) + uCenter);
}`,
  },
  {
    id: 'corduroy',
    thumb: { lines: 45 },
    name: 'Fine ripple',
    cat: 'warp',
    strength: 1,
    centered: true,
    desc: 'Hair-thin ribbing, like a lenticular print.',
    params: [
      R('lines', 'Lines', 20, 400, 150),
      R('amount', 'Amount', 0, 100, 60),
      R('angle', 'Angle', 0, 180, 0),
    ],
    frag: `
vec4 fx(vec2 q) {
  mat2 m = rot(radians(p_angle));
  vec2 p = m * (q - uCenter);
  float ph = p.y * p_lines * TAU;
  p.y += sin(ph) * p_amount * 0.007 / p_lines;
  vec4 col = S(transpose(m) * p + uCenter);
  col.rgb *= 1.0 + 0.0012 * p_amount * cos(ph);
  return clamp(col, 0.0, 1.0);
}`,
  },
  {
    id: 'smear',
    name: 'Wind smear',
    cat: 'warp',
    strength: 1,
    seeded: true,
    desc: 'Streaks dragged across the picture.',
    params: [
      R('length', 'Length', 0, 100, 45),
      R('angle', 'Angle', 0, 360, 0),
      R('streaks', 'Streak detail', 0, 100, 60),
    ],
    frag: `
vec4 fx(vec2 q) {
  float a = radians(p_angle);
  vec2 dir = vec2(cos(a), sin(a));
  float lane = dot(q, vec2(-dir.y, dir.x));
  float n = vnoise(vec2(lane * mix(40.0, 400.0, p_streaks * 0.01), 1.7) + SEEDV);
  float len = p_length * 0.003 * (0.15 + n * n * 1.6);
  vec4 acc = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < 24; i++) {
    float t = float(i) / 23.0;
    float w = 1.0 - t * 0.85;
    acc += S(q - dir * len * t) * w;
    total += w;
  }
  return acc / total;
}`,
  },
  {
    id: 'swirl',
    name: 'Swirl',
    cat: 'warp',
    strength: 2,
    centered: true,
    desc: 'One big twist around the centre.',
    params: [
      R('angle', 'Twist', -720, 720, 110),
      R('radius', 'Radius', 10, 250, 110),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec2 v = q - uCenter;
  float t = max(0.0, 1.0 - length(v) / (uExtent * p_radius * 0.01));
  return S(uCenter + rot(radians(p_angle) * t * t) * v);
}`,
  },
  {
    id: 'fisheye',
    name: 'Fisheye',
    cat: 'warp',
    strength: 1,
    centered: true,
    desc: 'Bulge or pinch around the centre.',
    params: [
      R('amount', 'Amount', -100, 100, 60),
      R('radius', 'Radius', 10, 250, 110),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec2 v = q - uCenter;
  float r = length(v) / (uExtent * p_radius * 0.01);
  if (r >= 1.0) return S(q);
  float k = p_amount * 0.01;
  float pw = k >= 0.0 ? 1.0 + k * 1.5 : 1.0 / (1.0 - k * 1.5);
  return S(uCenter + v * (pow(r, pw) / max(r, 1e-5)));
}`,
  },
  {
    id: 'zoomBlur',
    name: 'Zoom blur',
    cat: 'warp',
    strength: 1,
    centered: true,
    desc: 'Motion blur rushing out from the centre.',
    params: [R('amount', 'Amount', 0, 100, 30)],
    frag: `
vec4 fx(vec2 q) {
  vec2 v = q - uCenter;
  vec4 acc = vec4(0.0);
  float j = hash21(q / uPx);
  for (int i = 0; i < 28; i++) acc += S(uCenter + v * (1.0 - p_amount * 0.006 * (float(i) + j) / 28.0));
  return acc / 28.0;
}`,
  },
  {
    id: 'radialBlur',
    name: 'Spin blur',
    cat: 'warp',
    strength: 1,
    centered: true,
    desc: 'Motion blur circling the centre.',
    params: [R('amount', 'Amount', 0, 100, 25)],
    frag: `
vec4 fx(vec2 q) {
  vec2 v = q - uCenter;
  vec4 acc = vec4(0.0);
  float j = hash21(q / uPx);
  for (int i = 0; i < 28; i++) acc += S(uCenter + rot(radians(p_amount * 0.4) * ((float(i) + j) / 28.0 - 0.5)) * v);
  return acc / 28.0;
}`,
  },

  // ───────────────────────────── Print & paint ─────────────────────────────
  {
    id: 'halftone',
    thumb: { size: 3 },
    name: 'Halftone',
    cat: 'art',
    strength: 2,
    desc: 'Newsprint dots, in CMYK or a single ink.',
    params: [
      R('size', 'Dot spacing', 0.3, 6, 0.8, 0.1),
      R('angle', 'Screen angle', 0, 90, 15),
      O('mode', 'Inks', ['CMYK', 'Single ink'], 0),
      C('ink', 'Ink', '#1d2a44'),
      C('paper', 'Paper', '#f7f1e3'),
    ],
    frag: `
float htLayer(vec2 q, float ang, float cs, int ch) {
  mat2 m = rot(ang);
  vec2 p = m * q / cs;
  vec2 id = floor(p) + 0.5;
  vec3 c = straight(S(transpose(m) * (id * cs)), vec3(1.0));
  float k = 1.0 - max(c.r, max(c.g, c.b));
  vec3 cmy = (1.0 - c - k) / max(1.0 - k, 1e-4);
  float v = ch == 0 ? cmy.x : ch == 1 ? cmy.y : ch == 2 ? cmy.z : ch == 3 ? k : 1.0 - luma(c);
  float r = sqrt(clamp(v, 0.0, 1.0)) * 0.58;
  float aa = uPx / cs * 1.2;
  return 1.0 - smoothstep(r - aa, r + aa, length(p - id));
}
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  float a0 = radians(p_angle);
  float alpha = S(q).a;
  vec3 col;
  if (p_mode < 0.5) {
    vec3 cmy = vec3(htLayer(q, a0 + 0.2618, cs, 0), htLayer(q, a0 + 1.309, cs, 1), htLayer(q, a0, cs, 2));
    col = p_paper * (1.0 - cmy * 0.9) * (1.0 - htLayer(q, a0 + 0.7854, cs, 3) * 0.9);
  } else {
    col = mix(p_paper, p_ink, htLayer(q, a0 + 0.7854, cs, 4));
  }
  return vec4(col * alpha, alpha);
}`,
  },
  {
    id: 'engrave',
    thumb: { lines: 40 },
    name: 'Engraving',
    cat: 'art',
    strength: 2,
    seeded: true,
    desc: 'Banknote-style lines that swell in the shadows.',
    params: [
      R('lines', 'Lines', 20, 300, 140),
      R('angle', 'Angle', 0, 180, 35),
      R('contrast', 'Contrast', 0, 100, 40),
      R('wobble', 'Wobble', 0, 100, 25),
      T('hatch', 'Cross-hatch shadows', true),
      C('ink', 'Ink', '#1f2a3d'),
      C('paper', 'Paper', '#f4ecd8'),
    ],
    frag: `
float engraveLine(vec2 q, float ang, float thick) {
  vec2 p = rot(radians(ang)) * q;
  p.y += sin(p.x * 18.0 + uSeed) * p_wobble * 0.00012;
  float tri = abs(fract(p.y * p_lines) - 0.5) * 2.0;
  float aa = uPx * p_lines * 1.5;
  return 1.0 - smoothstep(thick - aa, thick + aa, tri);
}
vec4 fx(vec2 q) {
  vec4 s = S(q);
  float l = luma(straight(s, vec3(1.0)));
  float dark = clamp((0.5 - l) * (1.0 + p_contrast * 0.03) + 0.5, 0.0, 1.0);
  float ink = engraveLine(q, p_angle, clamp(dark, 0.03, 0.97));
  if (p_hatch > 0.5) ink = max(ink, engraveLine(q, p_angle + 63.0, clamp((dark - 0.55) * 2.0, 0.0, 0.9)));
  return vec4(mix(p_paper, p_ink, ink) * s.a, s.a);
}`,
  },
  {
    id: 'pointillism',
    thumb: { size: 4 },
    name: 'Pointillism',
    cat: 'art',
    strength: 2,
    seeded: true,
    desc: 'Dabs of paint on bare canvas.',
    params: [
      R('size', 'Dab size', 0.3, 8, 1, 0.1),
      R('fill', 'Coverage', 30, 100, 95),
      C('paper', 'Canvas', '#f3ead8'),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec2 id0 = floor(q / cs);
  float a0 = S(q).a;
  vec3 col = p_paper;
  float aa = uPx * 1.2;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = id0 + vec2(float(i), float(j));
    vec3 h = hash32(id + SEEDV);
    vec2 c = (id + 0.5 + (h.xy - 0.5) * 0.7) * cs;
    vec3 sc = straight(S(c), p_paper);
    sc = clamp(mix(vec3(luma(sc)), sc, 1.35) + (h.zxy - 0.5) * 0.1, 0.0, 1.0);
    float r = cs * (0.35 + 0.35 * h.z) * p_fill * 0.014;
    col = mix(col, sc, (1.0 - smoothstep(r - aa, r + aa, length(q - c))) * 0.93);
  }
  return vec4(col * a0, a0);
}`,
  },
  {
    id: 'oilPaint',
    thumb: { radius: 12 },
    name: 'Oil paint',
    cat: 'art',
    strength: 1,
    desc: 'Thick, smoothed brush strokes.',
    params: [R('radius', 'Brush size', 1, 14, 5, 0.5)],
    frag: `
vec4 fx(vec2 q) {
  float rad = p_radius * 0.0012;
  vec3 best = vec3(0.0);
  float bestVar = 1e9;
  for (int k = 0; k < 4; k++) {
    vec2 sg = vec2(k == 0 || k == 3 ? -1.0 : 1.0, k < 2 ? -1.0 : 1.0);
    vec3 mean = vec3(0.0), sq = vec3(0.0);
    for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
      vec3 c = S(q + vec2(float(i), float(j)) / 3.0 * rad * sg).rgb;
      mean += c;
      sq += c * c;
    }
    mean /= 16.0;
    sq = sq / 16.0 - mean * mean;
    float var = sq.r + sq.g + sq.b;
    if (var < bestVar) { bestVar = var; best = mean; }
  }
  return vec4(best, S(q).a);
}`,
  },
  {
    id: 'posterize',
    name: 'Comic poster',
    cat: 'art',
    strength: 1,
    desc: 'Flat colour bands with inked outlines.',
    params: [
      R('levels', 'Colour levels', 2, 10, 5),
      R('edges', 'Ink outlines', 0, 100, 65),
      R('saturation', 'Saturation', 0, 200, 130),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec4 s = S(q);
  vec3 c = straight(s, vec3(0.0));
  float n = floor(p_levels + 0.5) - 1.0;
  c = clamp(mix(vec3(luma(c)), c, p_saturation * 0.01), 0.0, 1.0);
  c = floor(c * n + 0.5) / n;
  c *= 1.0 - smoothstep(0.12, 0.5, sobel(q, max(uPx, 0.0014))) * p_edges * 0.01;
  return vec4(c * s.a, s.a);
}`,
  },
  {
    id: 'sketch',
    name: 'Pencil sketch',
    cat: 'art',
    strength: 2,
    seeded: true,
    desc: 'Graphite outlines and soft shading on paper.',
    params: [
      R('strength', 'Line strength', 0, 100, 65),
      R('shade', 'Shading', 0, 100, 50),
      R('tint', 'Keep colour', 0, 100, 45),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec4 s = S(q);
  vec3 c = straight(s, vec3(1.0));
  float e = sobel(q, max(uPx, 0.0012));
  float ink = smoothstep(0.12, 1.1, e * (0.4 + p_strength * 0.012));
  float grain = vnoise(rot(0.6) * q * vec2(90.0, 700.0) + SEEDV);
  float tone = 1.0 - ink * 0.85 - (1.0 - luma(c)) * p_shade * 0.004 * (0.5 + grain);
  vec3 col = vec3(0.97, 0.96, 0.93) * clamp(tone, 0.0, 1.0);
  col = mix(col, col * clamp(c * 1.25 + 0.1, 0.0, 1.0), p_tint * 0.01);
  return vec4(col * s.a, s.a);
}`,
  },
  {
    id: 'neon',
    name: 'Neon edges',
    cat: 'art',
    strength: 2,
    desc: 'Glowing outlines in the dark.',
    params: [
      R('glow', 'Glow', 0, 100, 60),
      R('dark', 'Darkness', 0, 100, 70),
      R('hue', 'Hue shift', 0, 360, 0),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec4 s = S(q);
  vec3 c = straight(s, vec3(0.0));
  float d = max(uPx, 0.0012);
  float e = sobel(q, d) + 0.6 * sobel(q, d * 2.5);
  vec3 hsv = rgb2hsv(c);
  vec3 glowc = hsv2rgb(vec3(fract(hsv.x + p_hue / 360.0), clamp(hsv.y * 1.4 + 0.35, 0.0, 1.0), 1.0));
  vec3 col = c * (1.0 - p_dark * 0.01) + glowc * smoothstep(0.25, 1.6, e) * (0.5 + p_glow * 0.012);
  return vec4(clamp(col, 0.0, 1.0) * s.a, s.a);
}`,
  },
  {
    id: 'bricks',
    thumb: { size: 6 },
    name: 'Toy bricks',
    cat: 'art',
    strength: 2,
    desc: 'Rebuilt from studded plastic bricks.',
    params: [
      R('size', 'Brick size', 0.8, 12, 2, 0.1),
      R('depth', 'Depth', 0, 100, 65),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec2 g = q / cs;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec4 s = S((id + 0.5) * cs);
  float r = length(f);
  float aa = uPx / cs * 1.5;
  float stud = 1.0 - smoothstep(0.3 - aa, 0.3 + aa, r);
  float lit = dot(f / max(r, 1e-4), vec2(-0.7071));
  float d = p_depth * 0.01;
  vec3 c = s.rgb;
  c *= 1.0 + d * stud * (0.08 + 0.3 * lit * smoothstep(0.14, 0.3, r));
  c *= 1.0 - d * 0.35 * (1.0 - stud) * (1.0 - smoothstep(0.3, 0.44, length(f - vec2(0.06))));
  c *= 1.0 - d * 0.45 * (1.0 - smoothstep(0.0, 0.04, 0.5 - max(abs(f.x), abs(f.y))));
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`,
  },
  {
    id: 'crossStitch',
    thumb: { size: 4.5 },
    name: 'Cross-stitch',
    cat: 'art',
    strength: 2,
    desc: 'Embroidered with little thread crosses.',
    params: [
      R('size', 'Stitch size', 0.4, 8, 1.1, 0.1),
      C('fabric', 'Fabric', '#efe6d2'),
    ],
    frag: `
vec4 fx(vec2 q) {
  float cs = p_size * 0.01;
  vec2 g = q / cs;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec4 s = S((id + 0.5) * cs);
  vec3 c = straight(s, vec3(1.0));
  float d1 = abs(f.x - f.y) * 0.7071, d2 = abs(f.x + f.y) * 0.7071;
  float w = 0.25;
  float aa = min(uPx / cs * 1.5, 0.08);
  float t1 = 1.0 - smoothstep(w - aa, w + aa, d1);
  float t2 = 1.0 - smoothstep(w - aa, w + aa, d2);
  float th = max(t1, t2) * (1.0 - smoothstep(0.44, 0.49, max(abs(f.x), abs(f.y))));
  float prof = t2 > 0.5 ? 1.0 - d2 / w * 0.55 : (1.0 - d1 / w * 0.55) * 0.8;
  vec3 cloth = p_fabric * (0.93 + 0.07 * vnoise(q * 900.0));
  return vec4(mix(cloth, clamp(c * 1.1, 0.0, 1.0) * prof, th) * s.a, s.a);
}`,
  },

  // ───────────────────────────── Glitch & colour ─────────────────────────────
  {
    id: 'glitch',
    name: 'Glitch',
    cat: 'retro',
    strength: 2,
    seeded: true,
    desc: 'Torn scanlines, shifted blocks and split colour channels.',
    params: [
      R('amount', 'Amount', 0, 100, 35),
      R('slices', 'Slices', 2, 80, 26),
      R('rgb', 'Colour split', 0, 100, 45),
      R('blocks', 'Block errors', 0, 100, 15),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec2 uv = q / uAsp;
  float n = floor(p_slices + 0.5);
  float band = floor(uv.y * n);
  float sh = hash11(band * 1.7 + uSeed) < 0.3 + p_amount * 0.004 ? (hash11(band * 5.3 + uSeed + 3.0) - 0.5) * p_amount * 0.004 : 0.0;
  float h2 = hash11(floor(uv.y * n * 3.7) * 2.3 + uSeed + 9.0);
  if (h2 < 0.08) sh += (h2 - 0.04) * p_amount * 0.03;
  vec2 p = q + vec2(sh * uAsp.x, 0.0);
  vec2 bid = floor(uv * vec2(n * 0.5, n * 0.9));
  if (hash21(bid + SEEDV) < p_blocks * 0.003) p += (hash22(bid + SEEDV + 4.0) - 0.5) * 0.14;
  float sp = p_rgb * 0.00012 * (1.0 + 120.0 * abs(sh));
  vec4 cr = S(p + vec2(sp, 0.0)), cg = S(p), cb = S(p - vec2(sp, 0.0));
  return vec4(cr.r, cg.g, cb.b, (cr.a + cg.a + cb.a) / 3.0);
}`,
  },
  {
    id: 'crt',
    thumb: { lines: 90 },
    name: 'VHS',
    cat: 'retro',
    strength: 1,
    seeded: true,
    desc: 'Scanlines, chroma bleed and tracking jitter.',
    params: [
      R('lines', 'Scanlines', 80, 600, 260),
      R('scan', 'Scanline depth', 0, 100, 55),
      R('bleed', 'Colour bleed', 0, 100, 55),
      R('jitter', 'Jitter', 0, 100, 40),
    ],
    frag: `
vec4 fx(vec2 q) {
  float row = floor(q.y * p_lines);
  float j = (hash11(row * 0.731 + uSeed) - 0.5) * p_jitter * 0.00012 * (1.0 + 9.0 * step(0.985, hash11(floor(row / 7.0) + uSeed)));
  vec2 p = q + vec2(j, 0.0);
  float bl = p_bleed * 0.00008;
  vec4 c0 = S(p);
  vec3 col = vec3(S(p + vec2(bl * 1.5, 0.0)).r, c0.g, S(p - vec2(bl * 1.5, 0.0)).b);
  col = mix(col, (S(p + vec2(bl * 3.0, 0.0)).rgb + S(p - vec2(bl * 3.0, 0.0)).rgb + col) / 3.0, p_bleed * 0.005);
  col *= 1.0 - p_scan * 0.0035 * (0.5 + 0.5 * cos(q.y * p_lines * TAU));
  col *= 1.0 + 0.05 * (hash21(floor(q / uPx) + uSeed) - 0.5);
  return vec4(clamp(col, 0.0, 1.0), c0.a);
}`,
  },
  {
    id: 'melt',
    name: 'Light drips',
    cat: 'retro',
    strength: 1,
    seeded: true,
    desc: 'Bright areas run down the picture like wet paint.',
    params: [
      R('amount', 'Length', 0, 100, 35),
      R('width', 'Drip width', 0.1, 5, 0.6, 0.1),
      R('angle', 'Angle', 0, 360, 90),
    ],
    frag: `
vec4 fx(vec2 q) {
  float a = radians(p_angle);
  vec2 dir = vec2(cos(a), sin(a));
  float lane = dot(q, vec2(-dir.y, dir.x)) / (p_width * 0.01);
  float len = p_amount * 0.006 * pow(hash11(floor(lane) * 1.37 + uSeed), 2.5) * (0.4 + vnoise(vec2(lane * 0.15, 3.3) + SEEDV));
  vec4 best = S(q);
  float bl = luma(best.rgb);
  for (int i = 1; i <= 16; i++) {
    float t = float(i) / 16.0;
    vec4 c = S(q - dir * len * t);
    float l = luma(c.rgb) * (1.0 - 0.25 * t);
    if (l > bl) { bl = l; best = c; }
  }
  return best;
}`,
  },
  {
    id: 'dither',
    thumb: { pixel: 14 },
    name: 'Retro dither',
    cat: 'retro',
    strength: 1,
    desc: 'Chunky ordered dithering from the 8-bit days.',
    params: [
      R('pixel', 'Pixel size', 1, 20, 3),
      R('levels', 'Levels', 2, 6, 4),
      T('mono', 'Two colours', false),
      C('dark', 'Dark', '#22223b'),
      C('light', 'Light', '#f2e9e4'),
    ],
    frag: `
vec4 fx(vec2 q) {
  float ps = max(p_pixel * 0.001, uPx);
  vec2 cell = floor(q / ps);
  vec4 s = S((cell + 0.5) * ps);
  vec3 c = straight(s, vec3(0.0));
  float th = bayer8(cell) - 0.5;
  float n = floor(p_levels + 0.5) - 1.0;
  if (p_mono > 0.5) c = mix(p_dark, p_light, clamp(floor(luma(c) * n + 0.5 + th) / n, 0.0, 1.0));
  else c = clamp(floor(c * n + 0.5 + th) / n, 0.0, 1.0);
  return vec4(c * s.a, s.a);
}`,
  },
  {
    id: 'duotone',
    name: 'Duotone',
    cat: 'retro',
    strength: 1,
    desc: 'Two-ink gradient map.',
    params: [
      C('dark', 'Shadows', '#2b1055'),
      C('light', 'Highlights', '#ffd166'),
      R('contrast', 'Contrast', 0, 100, 30),
      R('amount', 'Amount', 0, 100, 85),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec4 s = S(q);
  vec3 c = straight(s, vec3(0.0));
  float l = clamp((luma(c) - 0.5) * (1.0 + p_contrast * 0.02) + 0.5, 0.0, 1.0);
  return vec4(mix(c, mix(p_dark, p_light, l), p_amount * 0.01) * s.a, s.a);
}`,
  },
  {
    id: 'thermal',
    name: 'Thermal camera',
    cat: 'retro',
    strength: 1,
    desc: 'False-colour heat map.',
    params: [R('amount', 'Amount', 0, 100, 80)],
    frag: `
vec4 fx(vec2 q) {
  vec4 s = S(q);
  vec3 c = straight(s, vec3(0.0));
  float t = luma(c);
  vec3 m = mix(vec3(0.0, 0.0, 0.15), vec3(0.25, 0.0, 0.6), smoothstep(0.0, 0.25, t));
  m = mix(m, vec3(0.85, 0.1, 0.35), smoothstep(0.2, 0.5, t));
  m = mix(m, vec3(1.0, 0.6, 0.05), smoothstep(0.45, 0.75, t));
  m = mix(m, vec3(1.0, 1.0, 0.85), smoothstep(0.75, 1.0, t));
  return vec4(mix(c, m, p_amount * 0.01) * s.a, s.a);
}`,
  },
  {
    id: 'colorShift',
    name: 'Colour shift',
    cat: 'retro',
    strength: 1,
    desc: 'Hue, saturation and negative.',
    params: [
      R('hue', 'Hue', 0, 360, 120),
      R('saturation', 'Saturation', 0, 200, 100),
      T('invert', 'Invert', false),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec4 s = S(q);
  vec3 c = hueRotate(straight(s, vec3(0.0)), radians(p_hue));
  c = mix(vec3(luma(c)), c, p_saturation * 0.01);
  if (p_invert > 0.5) c = 1.0 - c;
  return vec4(clamp(c, 0.0, 1.0) * s.a, s.a);
}`,
  },

  // ───────────────────────────── Classic ─────────────────────────────
  {
    id: 'original',
    name: 'Original picture',
    cat: 'basic',
    strength: 0,
    hidden: true,
    desc: 'Shows the base picture without any masks. The compositor supplies it directly.',
    params: [],
    frag: 'vec4 fx(vec2 q) { return O(q); }',
  },
  {
    id: 'blur',
    thumb: { amount: 30 },
    name: 'Blur',
    cat: 'basic',
    strength: 1,
    desc: 'Gaussian blur.',
    blur: (p) => p.amount * 0.0006,
    params: [R('amount', 'Amount', 0, 100, 12)],
    frag: 'vec4 fx(vec2 q) { return S(q); }',
  },
  {
    id: 'pixelate',
    thumb: { size: 4 },
    name: 'Pixelate',
    cat: 'basic',
    strength: 1,
    desc: 'Big square pixels.',
    params: [R('size', 'Pixel size', 0.2, 12, 1.6, 0.1)],
    frag: `
vec4 fx(vec2 q) {
  float cs = max(p_size * 0.01, uPx);
  return S((floor(q / cs) + 0.5) * cs);
}`,
  },
  {
    id: 'noise',
    thumb: { grain: 6, amount: 60 },
    name: 'Noise',
    cat: 'basic',
    strength: 1,
    seeded: true,
    desc: 'Film grain.',
    params: [
      R('amount', 'Amount', 0, 100, 30),
      R('grain', 'Grain size', 1, 20, 1),
      T('mono', 'Monochrome', false),
    ],
    frag: `
vec4 fx(vec2 q) {
  vec4 s = S(q);
  vec2 cell = floor(q / max(uPx, p_grain * 0.0005));
  vec3 n = hash32(cell + SEEDV) - 0.5;
  if (p_mono > 0.5) n = vec3(n.x);
  return vec4(clamp(s.rgb + n * p_amount * 0.012 * s.a, 0.0, s.a), s.a);
}`,
  },
  {
    id: 'rgbSplit',
    name: 'RGB split',
    cat: 'basic',
    strength: 1,
    desc: 'Colour channels pulled apart.',
    params: [
      R('amount', 'Amount', 0, 100, 20),
      R('angle', 'Angle', 0, 360, 0),
    ],
    frag: `
vec4 fx(vec2 q) {
  float a = radians(p_angle);
  vec2 d = vec2(cos(a), sin(a)) * p_amount * 0.0004;
  vec4 cr = S(q + d), cg = S(q), cb = S(q - d);
  return vec4(cr.r, cg.g, cb.b, (cr.a + cg.a + cb.a) / 3.0);
}`,
  },
];

// Tinted glass: the cut glass shader with larger, coloured panes (one tile in the library).
{
  const base = EFFECTS.find((effect) => effect.id === 'cutGlass');
  const overrides = { size: 22, tint: 20, shift: 25 };

  EFFECTS.splice(EFFECTS.indexOf(base) + 1, 0, {
    ...base,
    id: 'tintedGlass',
    name: 'Tinted glass',
    desc: 'Large panes of softly coloured cut glass.',
    shader: 'cutGlass',
    params: base.params.map((param) => (param.key in overrides ? { ...param, value: overrides[param.key] } : param)),
  });
}

const EFFECT_MAP = new Map(EFFECTS.map((effect) => [effect.id, effect]));

export function getEffect(id) {
  return EFFECT_MAP.get(id) ?? EFFECT_MAP.get('blur');
}

export function hasEffect(id) {
  return EFFECT_MAP.has(id);
}

export function defaultParams(definition) {
  return Object.fromEntries(definition.params.map((param) => [param.key, param.value]));
}

/** Fills in defaults and clamps stored values so old or hand-edited documents stay valid. */
export function normalizeParams(definition, params = {}) {
  const result = {};

  for (const param of definition.params) {
    const value = params[param.key];

    if (param.type === 'color') {
      result[param.key] = /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : param.value;
    } else if (param.type === 'toggle') {
      result[param.key] = typeof value === 'boolean' ? value : param.value;
    } else if (param.type === 'select') {
      const index = Math.round(Number(value));
      result[param.key] = index >= 0 && index < param.options.length ? index : param.value;
    } else {
      const number = Number(value);
      result[param.key] = Number.isFinite(number) && value !== null && value !== undefined && value !== ''
        ? Math.max(param.min, Math.min(param.max, number))
        : param.value;
    }
  }

  return result;
}

// Sliders the Gentle / Strong presets scale, per effect. A leading '-' means smaller is stronger.
const INTENSITY = {
  cutGlass: ['shift', 'twist', 'zoom', 'tone', 'dispersion'],
  tintedGlass: ['shift', 'twist', 'zoom', 'tint', 'dispersion'],
  stainedGlass: ['flatten', 'tint'],
  flutedGlass: ['strength'],
  glassBlocks: ['lens', 'jitter'],
  frosted: ['amount'],
  privacyGlass: ['depth'],
  rain: ['density', 'fog'],
  ripple: ['amount'],
  water: ['amount', 'caustics'],
  bubbles: ['bulge'],
  prism: ['spread', 'shift'],
  crystal: ['size'],
  puzzle: ['shift', 'twist'],
  mosaic: ['shift', 'twist'],
  hexFlip: ['turn', 'flip'],
  shatter: ['shift'],
  weave: ['shift'],
  slats: ['shift'],
  rings: ['twist'],
  paperFold: ['depth'],
  lowPoly: ['size'],
  liquify: ['amount'],
  swirlGrid: ['angle'],
  wave: ['amount'],
  corduroy: ['amount'],
  smear: ['length'],
  swirl: ['angle'],
  fisheye: ['amount'],
  zoomBlur: ['amount'],
  radialBlur: ['amount'],
  halftone: ['size'],
  engrave: ['-lines'],
  pointillism: ['size'],
  oilPaint: ['radius'],
  posterize: ['-levels'],
  sketch: ['strength', '-tint'],
  neon: ['glow', 'dark'],
  bricks: ['size'],
  crossStitch: ['size'],
  glitch: ['amount', 'rgb', 'blocks'],
  crt: ['scan', 'bleed', 'jitter'],
  melt: ['amount'],
  dither: ['pixel', '-levels'],
  duotone: ['amount'],
  thermal: ['amount'],
  colorShift: ['hue'],
  blur: ['amount'],
  pixelate: ['size'],
  noise: ['amount'],
  rgbSplit: ['amount'],
};

export const INTENSITY_LEVELS = { gentle: 0.5, strong: 1.7 };

export function hasIntensity(definition) {
  return Boolean(INTENSITY[definition.id]?.length);
}

/**
 * `current` with the effect's intensity sliders set to their default times `factor`.
 * Every other setting (pane size, colours, ...) is left as it is.
 */
export function intensityParams(definition, factor, current = defaultParams(definition)) {
  const params = { ...current };

  for (const entry of INTENSITY[definition.id] ?? []) {
    const inverse = entry.startsWith('-');
    const param = definition.params.find((candidate) => candidate.key === entry.replace('-', ''));

    if (!param || param.type !== 'range') {
      continue;
    }

    const value = Math.max(param.min, Math.min(param.max, inverse ? param.value / factor : param.value * factor));

    params[param.key] = param.step < 1 ? Math.round(value / param.step) * param.step : Math.round(value);
  }

  return params;
}

export function hexToVec3(hex) {
  const value = Number.parseInt(String(hex).replace('#', ''), 16) || 0;
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Uniform values for an effect's parameters. */
export function paramUniforms(definition, params) {
  const uniforms = {};

  for (const param of definition.params) {
    const value = params?.[param.key] ?? param.value;

    if (param.type === 'color') {
      uniforms[`p_${param.key}`] = hexToVec3(value);
    } else if (param.type === 'toggle') {
      uniforms[`p_${param.key}`] = value ? 1 : 0;
    } else {
      uniforms[`p_${param.key}`] = Number(value) || 0;
    }
  }

  return uniforms;
}

export function effectShader(definition) {
  const uniforms = definition.params
    .map((param) => `uniform ${param.type === 'color' ? 'vec3' : 'float'} p_${param.key};`)
    .join('\n');

  return `${HEAD}${LIB}
uniform sampler2D uSrc;
uniform sampler2D uOrig;
uniform vec2 uAsp;
uniform float uPx;
uniform float uSeed;
uniform vec2 uCenter;
uniform float uExtent;
#define SEEDV (vec2(uSeed * 13.37, uSeed * 7.13))
${CELLS}
vec4 S(vec2 q) { return texture(uSrc, q / uAsp); }
vec4 O(vec2 q) { return texture(uOrig, q / uAsp); }
vec3 straight(vec4 c, vec3 fallback) { return c.a > 0.0 ? c.rgb / c.a : fallback; }
float sobel(vec2 q, float d) {
  float tl = luma(S(q + vec2(-d, -d)).rgb), tc = luma(S(q + vec2(0.0, -d)).rgb), tr = luma(S(q + vec2(d, -d)).rgb);
  float ml = luma(S(q + vec2(-d, 0.0)).rgb), mr = luma(S(q + vec2(d, 0.0)).rgb);
  float bl = luma(S(q + vec2(-d, d)).rgb), bc = luma(S(q + vec2(0.0, d)).rgb), br = luma(S(q + vec2(d, d)).rgb);
  return length(vec2(tr + 2.0 * mr + br - tl - 2.0 * ml - bl, bl + 2.0 * bc + br - tl - 2.0 * tc - tr));
}
// ── optics shared by the glass and water effects ──
const vec3 LIGHT = vec3(-0.46, -0.58, 0.67);
float fbm3(vec2 p) {
  float a = 0.5, t = 0.0;
  for (int i = 0; i < 3; i++) { t += a * vnoise(p); p = p * 2.07 + 13.1; a *= 0.5; }
  return t;
}
float cellDist(vec2 x) {
  vec2 n = floor(x), f = fract(x);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + hash22(n + g + SEEDV) - f;
    md = min(md, dot(r, r));
  }
  return sqrt(md);
}
// Surface height of patterned glass; features are about one unit of p across.
// 0 hammered, 1 pebbled, 2 flemish (hand-blown waves), 3 rippled, 4 seedy (waves + trapped bubbles)
float glassHeight(vec2 p, int kind) {
  if (kind == 0) { float d = cellDist(p * 1.4); return d * d * 0.9; }
  if (kind == 1) { float d = cellDist(p * 2.6); return 0.3 * (1.0 - smoothstep(0.0, 0.62, d)); }
  if (kind == 3) return 0.3 * sin(p.y * 4.5 + 2.4 * fbm3(p * 0.45 + SEEDV)) + 0.35 * fbm3(p * 1.3 + SEEDV);
  if (kind == 4) {
    vec3 h = hash32(floor(p * 1.7) + SEEDV);
    float seed = h.z < 0.4 ? 1.0 - smoothstep(0.0, 0.07 + 0.1 * h.z, length(fract(p * 1.7) - 0.25 - 0.5 * h.xy)) : 0.0;
    return 0.8 * fbm3(p * 0.5 + SEEDV) + 0.25 * seed;
  }
  return 1.3 * fbm3(p * 0.6 + SEEDV) + 0.12 * fbm3(p * 2.6 + SEEDV + 5.0);
}
vec2 glassSlope(vec2 p, int kind) {
  const float e = 0.04;
  float h = glassHeight(p, kind);
  return vec2(glassHeight(p + vec2(e, 0.0), kind) - h, glassHeight(p + vec2(0.0, e), kind) - h) / e;
}
// Looks at the picture through a surface that bends the view by o; disp splits the colours.
vec4 refractS(vec2 q, vec2 o, float disp) {
  vec4 g = S(q + o);
  if (disp < 0.002) return g;
  return vec4(S(q + o * (1.0 - disp)).r, g.g, S(q + o * (1.0 + disp)).b, g.a);
}
// Light on a glossy surface with the given slope: x = shading around 0, y = specular highlight.
vec2 glassLight(vec2 slope, float shininess) {
  vec3 n = normalize(vec3(-slope, 1.0));
  vec3 hv = normalize(LIGHT + vec3(0.0, 0.0, 1.0));
  return vec2(dot(n, LIGHT) - LIGHT.z, pow(max(dot(n, hv), 0.0), shininess));
}
${uniforms}
${definition.frag}
void main() { outColor = fx(vUv * uAsp); }`;
}
