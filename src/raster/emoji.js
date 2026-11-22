// Emoji masks rasterised with Canvas 2D, with Twemoji artwork (raster/twemoji.js) or the system's
// colour emoji font (params.style 1).
//
// The tile is a jittered grid of emojis drawn on a torus (an emoji crossing an edge is drawn
// again on the opposite side), so the texture repeats without seams and the layer can be wrapped
// across the whole picture like a tiled mask. Everything is seeded, so the same layer always
// draws the same way, in the preview and in the export.

import { drawEmoji, twemojiState } from './twemoji.js';

// Density 9 (the default) is the reference: the emoji size slider means the same at any density,
// so density only changes how far apart the emojis are.
const REFERENCE_ROWS = 9;

function seededRandom(seed) {
  let state = (Math.floor(Math.abs(seed || 0.5) * 9973 * 2147483) % 2147483646) + 1;

  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

/** Changes whenever the drawing would change. */
export function emojiSignature(layer) {
  const p = layer.params ?? {};
  const emojis = layer.emojis ?? [];

  return [
    emojis.join(''),
    p.style ? 'system' : twemojiState(emojis),
    layer.seed,
    p.density,
    p.size,
    p.variety,
    p.turn,
    p.scatter,
    p.bg,
    p.bgAlpha,
  ].join('|');
}

/**
 * Draws one tile of the mask, `size` pixels square, into a new canvas. One tile spans the
 * layer's natural box; `params.density` is the number of rows (and columns) in it, and
 * `params.size` the emoji size, independent of the density.
 */
export function renderEmojiTile(layer, size) {
  const p = layer.params ?? {};
  const emojis = layer.emojis?.length ? layer.emojis : ['🙂'];
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const random = seededRandom(layer.seed);
  const rows = Math.max(1, Math.round(p.density ?? 9));
  const cell = size / rows;
  const scatter = (p.scatter ?? 55) / 100;
  const variety = (p.variety ?? 35) / 100;
  const turn = ((p.turn ?? 25) * Math.PI) / 180;
  const twemoji = !p.style;
  const baseSize = (size / REFERENCE_ROWS) * ((p.size ?? 95) / 100);

  canvas.width = size;
  canvas.height = size;

  if ((p.bgAlpha ?? 0) > 0) {
    context.globalAlpha = p.bgAlpha / 100;
    context.fillStyle = /^#[0-9a-f]{6}$/i.test(p.bg ?? '') ? p.bg : '#f4efe6';
    context.fillRect(0, 0, size, size);
    context.globalAlpha = 1;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < rows; column += 1) {
      // Every other row is shifted by half a cell, so a plain grid still looks like a pattern.
      const x = (column + 0.5 + (row % 2) * 0.5 * (1 - scatter) + (random() - 0.5) * scatter) * cell;
      const y = (row + 0.5 + (random() - 0.5) * scatter) * cell;
      const emoji = emojis[Math.floor(random() * emojis.length)];
      const scale = Math.max(0.15, 1 + (random() * 2 - 1) * variety);
      const fontSize = Math.max(2, baseSize * scale);
      const angle = (random() * 2 - 1) * turn;
      const reach = fontSize * 0.75;

      // Draw again on the other side of every edge the emoji crosses: a copy one tile to the
      // right when it sticks out on the left, one tile to the left when it sticks out on the right.
      for (const ox of [-size, 0, size]) {
        if ((ox > 0 && x - reach >= 0) || (ox < 0 && x + reach <= size)) continue;

        for (const oy of [-size, 0, size]) {
          if ((oy > 0 && y - reach >= 0) || (oy < 0 && y + reach <= size)) continue;

          context.save();
          context.translate(x + ox, y + oy);
          context.rotate(angle);
          drawEmoji(context, emoji, fontSize, twemoji);
          context.restore();
        }
      }
    }
  }

  return canvas;
}

/** A small preview of an emoji set (library tiles). */
export function emojiPreview(emojis, { width = 176, height = 128, seed = 7 } = {}) {
  const tile = renderEmojiTile({ emojis, seed, params: { density: 4, size: 95 * (9 / 4), variety: 30, turn: 25, scatter: 55, bgAlpha: 0 } }, 128);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = context.createPattern(tile, 'repeat');
  context.fillRect(0, 0, width, height);
  return canvas;
}
