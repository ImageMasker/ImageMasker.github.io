// Separate background: renders the chosen image layer, runs the in-browser model on it and adds
// the cut-out subject as a new layer above it. The source layer stays visible, so masks can go
// between the subject and the picture behind it. With an outline drawn by the lasso tool only that
// area goes through the model, and the cut-out is kept inside the outline, so one item of several
// can be separated.

import { layerBounds } from '../core/geometry.js';
import { imageLayer, insertLayer } from '../core/model.js';
import { BackgroundRemover } from '../integrations/BackgroundRemover.js';

function progressLabel(key, current = 0, total = 0) {
  if (typeof key !== 'string') {
    return 'Separating background';
  }

  if (key.startsWith('fetch:')) {
    return total > 0 ? `Downloading model (${Math.round((current / total) * 100)}%)` : 'Downloading model';
  }

  return {
    'compute:decode': 'Decoding image',
    'compute:inference': 'Running model',
    'compute:mask': 'Building mask',
    'compute:encode': 'Encoding cutout',
  }[key] ?? 'Separating background';
}

export class BackgroundTools {
  constructor(app) {
    this.app = app;
    this.remover = new BackgroundRemover();
    this.count = 0;
    this.status = { busy: false, label: '' };
  }

  setStatus(busy, label = '') {
    this.status = { busy, label };
    this.app.bus.emit('background-status', this.status);
  }

  clampRect(rect) {
    const doc = this.app.store.doc;
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const right = Math.min(doc.width, Math.ceil(rect.x + rect.width));
    const bottom = Math.min(doc.height, Math.ceil(rect.y + rect.height));

    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
  }

  /** Lasso tool: draw around the item to separate from `layerId` (null: the base picture). */
  startLasso(layerId = null) {
    const app = this.app;

    if (this.status.busy || !app.requireImage('Load an image before separating the background.')) {
      return;
    }

    if (app.toolName === 'lasso') {
      app.setTool('select');
      return;
    }

    app.tools.lasso.layerId = layerId;
    app.setTool('lasso');
    app.notify('Draw a loop around the item to separate. Esc cancels.', 'info', 3600);
  }

  /** The area handed to the model for an outline: its bounds with a little room around them. */
  outlineRect(points, bounds) {
    const xs = points.filter((_, index) => index % 2 === 0);
    const ys = points.filter((_, index) => index % 2 === 1);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const pad = Math.max(8, Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) * 0.04);
    const x = Math.max(bounds.x, x0 - pad);
    const y = Math.max(bounds.y, y0 - pad);

    return {
      x,
      y,
      width: Math.min(bounds.x + bounds.width, Math.max(...xs) + pad) - x,
      height: Math.min(bounds.y + bounds.height, Math.max(...ys) + pad) - y,
    };
  }

  /** Keeps the cut-out only inside the outline (document pixels); null when nothing is left. */
  async clipToOutline(blob, rect, points) {
    const image = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const sx = image.width / rect.width;
    const sy = image.height / rect.height;

    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);
    image.close?.();
    context.globalCompositeOperation = 'destination-in';
    context.beginPath();

    for (let index = 0; index < points.length; index += 2) {
      context.lineTo((points[index] - rect.x) * sx, (points[index + 1] - rect.y) * sy);
    }

    context.closePath();
    context.fill();

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let found = false;

    for (let index = 3; index < pixels.length && !found; index += 4) {
      found = pixels[index] > 8;
    }

    return found ? new Promise((resolve) => canvas.toBlob(resolve, 'image/png')) : null;
  }

  /** PNG data URL of `rect` from a render of a single layer. */
  capture(rect, layerId) {
    const { store, stage } = this.app;
    const full = stage.renderToCanvas(store.doc, { scale: 1, only: new Set([layerId]) });
    const scale = full.width / store.doc.width;
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    canvas.getContext('2d').drawImage(full, -Math.round(rect.x * scale), -Math.round(rect.y * scale));
    return canvas.toDataURL('image/png');
  }

  /**
   * Removes the background of `layerId`, or of the base picture when no id is given. `points`
   * (flat document pixels) limits it to the area inside that outline.
   */
  async remove(layerId = null, { points = null } = {}) {
    const app = this.app;

    if (this.status.busy || !app.requireImage('Load an image before separating the background.')) {
      return;
    }

    this.setStatus(true, 'Preparing');

    try {
      const doc = app.store.doc;
      const target = layerId ? app.store.layer(layerId) : doc.layers.find((layer) => layer.type === 'image' && layer.base);

      if (!target || target.type !== 'image') {
        throw new Error('Select an image layer first.');
      }

      const bounds = this.clampRect(layerBounds(target));
      const rect = points && bounds.width && bounds.height ? this.clampRect(this.outlineRect(points, bounds)) : bounds;

      if (!rect.width || !rect.height) {
        throw new Error(points ? 'The area you drew is outside the picture.' : 'The selected layer has no visible area to process.');
      }

      const cutout = await this.remover.removeBackground(this.capture(rect, target.id), {
        onProgress: (key, current, total) => this.setStatus(true, progressLabel(key, current, total)),
      });
      const blob = points ? await this.clipToOutline(cutout, rect, points) : cutout;

      if (!blob) {
        throw new Error('Nothing was found to separate inside the area you drew. Try drawing around it a little more generously.');
      }

      const asset = await app.assets.fromBlob(blob, { name: 'Cutout' });
      const count = (this.count += 1);
      const layer = imageLayer(doc, asset, { name: `${target.name} cutout${count > 1 ? ` ${count}` : ''}`, rect });

      app.store.apply(points ? 'Separate item' : 'Separate background', (current) => {
        const index = current.layers.findIndex((entry) => entry.id === target.id);

        return insertLayer(current, layer, index + 1);
      });
      app.store.select([layer.id]);
      app.setTool('select');
      app.notify(`The ${points ? 'item' : 'subject'} is now its own layer above the picture. Put masks between the two, or hide the picture to keep only the ${points ? 'item' : 'subject'}.`, 'success', 5200);
    } catch (error) {
      app.notify(error.message, 'error', 4200);
    } finally {
      this.setStatus(false);
    }
  }
}
