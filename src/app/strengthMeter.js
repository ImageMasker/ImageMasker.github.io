// Internal "how different does the masked picture look" score, used by the random mask to land
// on the strength the user picked. It compares the masked render against the unmasked one the way
// image search fingerprints roughly do: a perceptual hash of the brightness (colour changes barely
// count) plus how well the coarse structure still lines up.
//   0 = looks the same, about 1 = looks like a different picture.
// It is only an estimate; reverse image search sites use their own, unknown, features.

const GRID = 32;
const DETAIL = 96;

/** Unmasked version of the document: just the pictures, text and drawings. */
export function unmaskedDoc(doc) {
  return { ...doc, layers: doc.layers.filter((layer) => layer.type !== 'effect' && layer.type !== 'mask') };
}

/** Renders `doc` small and returns its pixels. */
export function renderSmall(stage, doc, size = 192) {
  const scale = Math.min(1, size / Math.max(doc.width, doc.height));
  const canvas = stage.renderToCanvas(doc, { scale });
  const context = canvas.getContext('2d', { willReadFrequently: true });

  return { data: context.getImageData(0, 0, canvas.width, canvas.height), scale };
}

/** Area-averaged grid×grid brightness of a region (`rect` in document pixels, or the whole picture). */
function grayGrid({ data: image, scale }, rect, GRID = 32) {
  const { width, height, data } = image;
  const x0 = rect ? Math.max(0, Math.floor(rect.x * scale)) : 0;
  const y0 = rect ? Math.max(0, Math.floor(rect.y * scale)) : 0;
  const x1 = rect ? Math.min(width, Math.ceil((rect.x + rect.width) * scale)) : width;
  const y1 = rect ? Math.min(height, Math.ceil((rect.y + rect.height) * scale)) : height;
  const sums = new Float64Array(GRID * GRID);
  const counts = new Float64Array(GRID * GRID);
  const spanX = Math.max(1, x1 - x0);
  const spanY = Math.max(1, y1 - y0);

  for (let y = y0; y < y1; y += 1) {
    const gy = Math.min(GRID - 1, Math.floor(((y - y0) / spanY) * GRID));

    for (let x = x0; x < x1; x += 1) {
      const gx = Math.min(GRID - 1, Math.floor(((x - x0) / spanX) * GRID));
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3] / 255;
      // Transparent areas count as white, like an upload without a background would show.
      const luma = (0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]) * alpha + 255 * (1 - alpha);

      sums[gy * GRID + gx] += luma;
      counts[gy * GRID + gx] += 1;
    }
  }

  return sums.map((sum, index) => (counts[index] ? sum / counts[index] : 255));
}

const COS = Array.from({ length: 8 }, (_, u) => Array.from({ length: GRID }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * GRID))));

/** 63-bit perceptual hash (low 8×8 DCT frequencies minus DC, against their median). */
function phash(grid) {
  const coefficients = [];

  for (let v = 0; v < 8; v += 1) {
    for (let u = 0; u < 8; u += 1) {
      if (u === 0 && v === 0) {
        continue;
      }

      let sum = 0;

      for (let y = 0; y < GRID; y += 1) {
        for (let x = 0; x < GRID; x += 1) {
          sum += grid[y * GRID + x] * COS[u][x] * COS[v][y];
        }
      }

      coefficients.push(sum);
    }
  }

  const median = [...coefficients].sort((a, b) => a - b)[coefficients.length >> 1];

  return coefficients.map((value) => value > median);
}

function correlation(a, b) {
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const ma = mean(a);
  const mb = mean(b);
  let ab = 0;
  let aa = 0;
  let bb = 0;

  for (let index = 0; index < a.length; index += 1) {
    const da = a[index] - ma;
    const db = b[index] - mb;

    ab += da * db;
    aa += da * da;
    bb += db * db;
  }

  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/** Fine detail only: brightness minus its 3×3 local average. */
function highPass(grid, size) {
  const out = new Float64Array(grid.length);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sum = 0;
      let count = 0;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
            sum += grid[ny * size + nx];
            count += 1;
          }
        }
      }

      out[y * size + x] = grid[y * size + x] - sum / count;
    }
  }

  return out;
}

/**
 * Compares two `renderSmall` results; `rect` limits it to one collage piece. Mixes the coarse
 * fingerprint (perceptual hash + layout correlation) with how much fine detail still lines up,
 * which is what feature-matching search engines lean on.
 */
export function changeScore(original, masked, rect = null) {
  const a = grayGrid(original, rect);
  const b = grayGrid(masked, rect);
  const ha = phash(a);
  const hb = phash(b);
  const distance = ha.reduce((sum, bit, index) => sum + (bit !== hb[index] ? 1 : 0), 0);
  const coarse = 0.5 * Math.min(1, distance / 28) + 0.5 * (1 - Math.max(0, correlation(a, b)));
  const detail = 1 - Math.max(0, correlation(highPass(grayGrid(original, rect, DETAIL), DETAIL), highPass(grayGrid(masked, rect, DETAIL), DETAIL)));

  return 0.35 * coarse + 0.65 * detail;
}
