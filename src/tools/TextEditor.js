// In-place text editing: a textarea laid over the text layer, which is hidden while typing.

import { fitText, findLayer, removeLayers, updateLayer } from '../core/model.js';
import { measureText } from '../raster/text.js';

export class TextEditor {
  constructor(app) {
    this.app = app;
    this.layerId = null;
    this.input = document.createElement('textarea');
    this.input.className = 'text-editor-overlay hidden';
    this.input.setAttribute('aria-label', 'Edit text');
    this.input.spellcheck = false;
    app.stage.html.append(this.input);

    this.input.addEventListener('input', () => {
      if (this.layerId) {
        app.store.updateLayer(this.layerId, (layer) => fitText({ ...layer, text: this.input.value }));
      }
    });
    this.input.addEventListener('keydown', (event) => {
      event.stopPropagation();

      if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        this.close();
      }
    });
    this.input.addEventListener('blur', () => this.close());
    app.bus.on('view', () => this.position());
    app.store.on('doc', () => this.position());
  }

  open(layerId) {
    const layer = findLayer(this.app.store.doc, layerId);

    if (!layer || layer.type !== 'text') {
      return;
    }

    this.close();
    this.layerId = layerId;
    this.app.store.begin();
    this.app.stage.setHidden(layerId, true);
    this.input.value = layer.text;
    this.input.classList.remove('hidden');
    this.position();
    this.app.bus.emit('text-editing', true);
    this.input.focus();
    this.input.select();
  }

  position() {
    const layer = this.layerId ? findLayer(this.app.store.doc, this.layerId) : null;

    if (!layer) {
      if (this.layerId) {
        this.close();
      }
      return;
    }

    const stage = this.app.stage;
    const zoom = stage.view.zoom;
    const center = stage.toScreen(layer.x, layer.y);
    const natural = measureText(layer);
    const style = this.input.style;

    // Lay the box out at the layer's natural size and let CSS scale it, so stretched text lines up.
    style.width = `${natural.width}px`;
    style.height = `${natural.height}px`;
    style.padding = `${natural.pad}px`;
    style.fontSize = `${layer.size}px`;
    style.fontFamily = `"${layer.font}", sans-serif`;
    style.fontWeight = layer.bold ? '700' : '400';
    style.fontStyle = layer.italic ? 'italic' : 'normal';
    style.textAlign = layer.align;
    style.color = layer.color;
    style.transform =
      `translate(${center.x}px, ${center.y}px) translate(-50%, -50%) rotate(${layer.rotation}rad) ` +
      `scale(${(layer.sx || 1) * zoom}, ${(layer.sy || 1) * zoom})`;
  }

  close() {
    const layerId = this.layerId;

    if (!layerId) {
      return;
    }

    const { store, stage } = this.app;

    this.layerId = null;
    this.input.classList.add('hidden');
    stage.setHidden(layerId, false);

    const layer = findLayer(store.doc, layerId);

    if (layer && !layer.text.trim()) {
      store.set(removeLayers(store.doc, [layerId]));
      store.select([]);
    } else if (layer) {
      store.set(updateLayer(store.doc, layerId, { name: layer.text.trim().split('\n')[0].slice(0, 24) || 'Text' }));
    }

    store.end('Edit text');
    this.app.bus.emit('text-editing', false);
  }
}
