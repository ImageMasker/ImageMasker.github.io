// Separate background: renders the chosen image layer, runs the in-browser model on it and adds
// the cut-out subject as a new layer above it. The source layer stays visible, so masks can go
// between the subject and the picture behind it.

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

  /** Removes the background of `layerId`, or of the base picture when no id is given. */
  async remove(layerId = null) {
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

      const rect = this.clampRect(layerBounds(target));

      if (!rect.width || !rect.height) {
        throw new Error('The selected layer has no visible area to process.');
      }

      const blob = await this.remover.removeBackground(this.capture(rect, target.id), {
        onProgress: (key, current, total) => this.setStatus(true, progressLabel(key, current, total)),
      });
      const asset = await app.assets.fromBlob(blob, { name: 'Cutout' });
      const count = (this.count += 1);
      const layer = imageLayer(doc, asset, { name: `${target.name} cutout${count > 1 ? ` ${count}` : ''}`, rect });

      app.store.apply('Separate background', (current) => {
        const index = current.layers.findIndex((entry) => entry.id === target.id);

        return insertLayer(current, layer, index + 1);
      });
      app.store.select([layer.id]);
      app.setTool('select');
      app.notify('The subject is now its own layer above the picture. Put masks between the two, or hide the picture to keep only the subject.', 'success', 5200);
    } catch (error) {
      app.notify(error.message, 'error', 4200);
    } finally {
      this.setStatus(false);
    }
  }
}
