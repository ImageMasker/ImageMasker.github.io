import { loadImageElement } from '../utils/image.js';

const motifImageCache = new Map();
const renderedCanvasCache = new Map();

async function loadMotifImage(src) {
  if (!motifImageCache.has(src)) {
    motifImageCache.set(src, loadImageElement(src));
  }

  return motifImageCache.get(src);
}

export async function renderFlagMaskToCanvas(flag) {
  if (renderedCanvasCache.has(flag.id)) {
    return renderedCanvasCache.get(flag.id);
  }

  if (flag.renderMode === 'full') {
    const image = await loadMotifImage(flag.full.src);
    renderedCanvasCache.set(flag.id, image);
    return image;
  }

  const motif = await loadMotifImage(flag.motif.src);
  const canvas = document.createElement('canvas');
  canvas.width = flag.source.width;
  canvas.height = flag.source.height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error(`Could not create flag mask canvas for ${flag.name}.`);
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const row of flag.pattern.rows) {
    for (const centerX of row.centers) {
      context.drawImage(
        motif,
        centerX - flag.motif.anchorX,
        row.y - flag.motif.anchorY
      );
    }
  }

  renderedCanvasCache.set(flag.id, canvas);
  return canvas;
}
