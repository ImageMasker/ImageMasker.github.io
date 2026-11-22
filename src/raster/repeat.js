// "Repeat as a pattern" for image masks: the image drawn small, many times, in staggered rows with
// gaps, the way the flag masks are made. One tile covers the layer's box and repeats seamlessly
// (each row wraps around), so the layer can be wrapped across the whole picture.

export const REPEAT_DEFAULTS = Object.freeze({ rows: 12, size: 80, stagger: 50 });

const clamp = (value, min, max, fallback) => (Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback);

/** A valid repeat setting, or null for a plain overlay. */
export function normalizeRepeat(repeat) {
  if (!repeat || typeof repeat !== 'object') {
    return null;
  }

  return {
    rows: Math.round(clamp(repeat.rows, 1, 40, REPEAT_DEFAULTS.rows)),
    size: clamp(repeat.size, 10, 100, REPEAT_DEFAULTS.size),
    stagger: clamp(repeat.stagger, 0, 100, REPEAT_DEFAULTS.stagger),
  };
}

export function repeatSignature(repeat) {
  return repeat ? `${repeat.rows}|${repeat.size}|${repeat.stagger}` : '';
}

/**
 * Draws one `width` × `height` tile of `source` repeated in `repeat.rows` rows. The image keeps
 * its proportions; `size` is how much of each cell it fills, `stagger` how far every other row
 * is shifted (50 = half a cell, like the flag masks).
 */
export function renderRepeatTile(source, repeat, width, height) {
  const imageWidth = source.naturalWidth || source.width;
  const imageHeight = source.naturalHeight || source.height;
  const aspect = imageWidth / imageHeight;
  const { rows, size, stagger } = normalizeRepeat(repeat) ?? REPEAT_DEFAULTS;
  const fill = size / 100;
  const cellHeight = height / rows;
  // Cells as wide as the image would be at the cell's height, so the gaps match both ways.
  const columns = Math.max(1, Math.round(width / (cellHeight * aspect)));
  const cellWidth = width / columns;
  // Fits the image in the cell at `fill`, whichever side limits it.
  const drawHeight = Math.min(cellHeight * fill, (cellWidth * fill) / aspect);
  const drawWidth = drawHeight * aspect;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingQuality = 'high';

  for (let row = 0; row < rows; row += 1) {
    const shift = (row % 2) * (stagger / 100) * cellWidth;
    const y = row * cellHeight + (cellHeight - drawHeight) / 2;

    for (let column = 0; column < columns; column += 1) {
      const x = column * cellWidth + (cellWidth - drawWidth) / 2 + shift;

      context.drawImage(source, x, y, drawWidth, drawHeight);

      // The shifted row runs off the right edge: draw that part again on the left.
      if (x + drawWidth > width) {
        context.drawImage(source, x - width, y, drawWidth, drawHeight);
      }
    }
  }

  return canvas;
}
