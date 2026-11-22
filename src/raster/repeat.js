// "Repeat as a pattern" for image masks: the image drawn small, many times, in staggered rows with
// gaps, the way the flag masks are made. One tile covers the layer's box and repeats seamlessly
// (a copy crossing an edge is drawn again on the opposite side), so the layer can be wrapped
// across the whole picture.
//
// Density sets how many rows there are (so how far apart the copies are) and Image size how big
// each copy is, independently. Wobble tilts and nudges every copy its own way, and Warp bends each
// copy on its own (unlike the layer's Warp, which bends the whole mask). Both are seeded.

export const REPEAT_DEFAULTS = Object.freeze({ rows: 12, size: 80, stagger: 50, wobble: 0, warp: 0, seed: 0.5 });

// Image size 100 = one row's height at the default density.
const REFERENCE_ROWS = REPEAT_DEFAULTS.rows;
// Differently warped versions of the image the copies choose from.
const WARP_VARIANTS = 5;

const clamp = (value, min, max, fallback) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Math.max(min, Math.min(max, Number(value))) : fallback);

/** A valid repeat setting, or null for a plain overlay. */
export function normalizeRepeat(repeat) {
  if (!repeat || typeof repeat !== 'object') {
    return null;
  }

  return {
    rows: Math.round(clamp(repeat.rows, 1, 40, REPEAT_DEFAULTS.rows)),
    size: clamp(repeat.size, 10, 300, REPEAT_DEFAULTS.size),
    stagger: clamp(repeat.stagger, 0, 100, REPEAT_DEFAULTS.stagger),
    wobble: clamp(repeat.wobble, 0, 100, REPEAT_DEFAULTS.wobble),
    warp: clamp(repeat.warp, 0, 100, REPEAT_DEFAULTS.warp),
    seed: clamp(repeat.seed, 0, 1000, REPEAT_DEFAULTS.seed),
  };
}

export function repeatSignature(repeat) {
  return repeat ? [repeat.rows, repeat.size, repeat.stagger, repeat.wobble, repeat.warp, repeat.seed].join('|') : '';
}

function seededRandom(seed) {
  let state = (Math.floor(Math.abs(seed || 0.5) * 9973 * 2147483) % 2147483646) + 1;

  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

/**
 * The image bent like jelly: horizontal slices shifted along one wave, then vertical slices
 * along another. Returns a canvas `pad` pixels larger on every side than `width` × `height`.
 */
function warpedCopy(source, width, height, amount, random) {
  const pad = Math.ceil(Math.max(width, height) * 0.12 * amount) + 1;
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const flat = document.createElement('canvas');
  const bent = document.createElement('canvas');
  const out = document.createElement('canvas');
  const slices = Math.max(8, Math.min(48, Math.round(Math.max(w, h) / 3)));

  flat.width = w;
  flat.height = h;
  flat.getContext('2d').drawImage(source, 0, 0, w, h);

  bent.width = out.width = w + pad * 2;
  bent.height = out.height = h + pad * 2;

  const wave = () => {
    const phase = random() * Math.PI * 2;
    const frequency = 0.7 + random() * 1.1;

    return (t) => Math.sin(phase + t * Math.PI * 2 * frequency) * (pad - 1);
  };
  const across = wave();
  const down = wave();
  const bentContext = bent.getContext('2d');
  const outContext = out.getContext('2d');

  for (let index = 0; index < slices; index += 1) {
    const y0 = Math.floor((index * h) / slices);
    const y1 = Math.floor(((index + 1) * h) / slices);

    // One pixel of overlap hides the seams between slices.
    bentContext.drawImage(flat, 0, y0, w, y1 - y0 + 1, pad + across((y0 + y1) / 2 / h), pad + y0, w, y1 - y0 + 1);
  }

  for (let index = 0; index < slices; index += 1) {
    const x0 = Math.floor((index * bent.width) / slices);
    const x1 = Math.floor(((index + 1) * bent.width) / slices);

    outContext.drawImage(bent, x0, 0, x1 - x0 + 1, bent.height, x0, down((x0 + x1) / 2 / bent.width), x1 - x0 + 1, bent.height);
  }

  return { canvas: out, pad };
}

/**
 * Draws one `width` × `height` tile of `source` repeated in `repeat.rows` rows. The image keeps
 * its proportions; `size` is how big each copy is (100 = a row's height at the default density),
 * `stagger` how far every other row is shifted (50 = half a cell, like the flag masks).
 */
export function renderRepeatTile(source, repeat, width, height) {
  const imageWidth = source.naturalWidth || source.width;
  const imageHeight = source.naturalHeight || source.height;
  const aspect = imageWidth / imageHeight;
  const { rows, size, stagger, wobble, warp, seed } = normalizeRepeat(repeat) ?? REPEAT_DEFAULTS;
  const cellHeight = height / rows;
  // Cells as wide as the image would be at the cell's height, so the gaps match both ways.
  const columns = Math.max(1, Math.round(width / (cellHeight * aspect)));
  const cellWidth = width / columns;
  const drawHeight = (height / REFERENCE_ROWS) * (size / 100);
  const drawWidth = drawHeight * aspect;
  const random = seededRandom(seed);
  const tilt = (wobble / 100) * (Math.PI / 4);
  const nudge = (wobble / 100) * 0.35;
  const variants = warp > 0
    ? Array.from({ length: WARP_VARIANTS }, () => warpedCopy(source, drawWidth, drawHeight, warp / 100, random))
    : null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const reach = Math.hypot(drawWidth, drawHeight) / 2 + (variants?.[0].pad ?? 0);

  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingQuality = 'high';

  for (let row = 0; row < rows; row += 1) {
    const shift = (row % 2) * (stagger / 100) * cellWidth;

    for (let column = 0; column < columns; column += 1) {
      const x = ((column + 0.5 + (random() * 2 - 1) * nudge) * cellWidth + shift) % width;
      const y = (row + 0.5 + (random() * 2 - 1) * nudge) * cellHeight;
      const angle = (random() * 2 - 1) * tilt;
      const variant = variants?.[Math.floor(random() * variants.length)];

      // Drawn again on the other side of every edge it crosses, so the tile has no seams.
      for (const ox of [-width, 0, width]) {
        if ((ox > 0 && x - reach >= 0) || (ox < 0 && x + reach <= width)) continue;

        for (const oy of [-height, 0, height]) {
          if ((oy > 0 && y - reach >= 0) || (oy < 0 && y + reach <= height)) continue;

          context.save();
          context.translate(x + ox, y + oy);
          context.rotate(angle);

          if (variant) {
            context.drawImage(variant.canvas, -drawWidth / 2 - variant.pad, -drawHeight / 2 - variant.pad);
          } else {
            context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          }

          context.restore();
        }
      }
    }
  }

  return canvas;
}
