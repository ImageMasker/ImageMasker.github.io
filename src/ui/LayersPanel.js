// Layer list: select, rename, hide, lock, reorder (drag or buttons), duplicate and delete.

import { describeLayer, moveLayer, updateLayer } from '../core/model.js';
import { el } from '../utils/dom.js';
import { icon, iconButton } from './kit.js';

const TYPE_ICON = { image: 'image', mask: 'grid', effect: 'sparkle', drawing: 'pencil', text: 'text', rect: 'rect' };

export class LayersPanel {
  constructor(app) {
    this.app = app;
    this.signature = '';
    this.dragId = null;
    this.thumbCache = new Map();
    this.list = el('div', { className: 'layer-list', role: 'listbox', 'aria-label': 'Layers' });
    this.empty = el('div', { className: 'panel-empty-state', textContent: 'Load an image to start. Layers you add will show up here.' });
    this.actions = el('div', { className: 'layer-actions' }, [
      iconButton('up', 'Move layer up', () => app.reorderSelected(1)),
      iconButton('down', 'Move layer down', () => app.reorderSelected(-1)),
      iconButton('duplicate', 'Duplicate layer', () => app.duplicateSelected()),
      iconButton('trash', 'Delete layer', () => app.deleteSelected()),
    ]);
    this.element = el('fieldset', { id: 'layers', className: 'panel-fieldset layers-panel' }, [
      el('legend', { textContent: 'Layers' }),
      this.empty,
      this.list,
      this.actions,
    ]);

    const update = () => this.render();

    app.store.on('doc', update);
    app.store.on('selection', update);
    this.render();
  }

  thumb(layer) {
    const asset = layer.assetId ? this.app.assets.get(layer.assetId) : null;

    if (!asset) {
      return el('span', { className: 'layer-thumb' }, [icon(TYPE_ICON[layer.type] ?? 'image')]);
    }

    let url = this.thumbCache.get(asset.id);

    if (!url) {
      const canvas = document.createElement('canvas');
      const scale = 56 / Math.max(asset.width, asset.height);

      canvas.width = Math.max(1, Math.round(asset.width * scale));
      canvas.height = Math.max(1, Math.round(asset.height * scale));
      canvas.getContext('2d').drawImage(asset.source, 0, 0, canvas.width, canvas.height);
      url = canvas.toDataURL('image/png');
      this.thumbCache.set(asset.id, url);
    }

    return el('span', { className: 'layer-thumb layer-thumb--image' }, [el('img', { src: url, alt: '' })]);
  }

  render() {
    const { store } = this.app;
    const layers = store.hasImage ? [...store.doc.layers].reverse() : [];
    const signature = layers
      .map((layer) => [layer.id, layer.name, layer.visible, layer.locked, layer.assetId ?? '', layer.coverage ?? '', layer.base ?? '', store.selection.includes(layer.id)].join(':'))
      .join('|');

    this.empty.classList.toggle('hidden', layers.length > 0);
    this.actions.classList.toggle('hidden', layers.length === 0);

    if (signature === this.signature || this.list.querySelector('.layer-name-input')) {
      return;
    }

    this.signature = signature;
    this.list.replaceChildren(...layers.map((layer) => this.row(layer)));
  }

  row(layer) {
    const { store } = this.app;
    const selected = store.selection.includes(layer.id);
    const name = el('span', { className: 'layer-name', textContent: layer.name, title: 'Double-click to rename' });
    const element = el('div', {
      className: `layer-row${selected ? ' is-selected' : ''}${layer.visible ? '' : ' is-hidden'}`,
      role: 'option',
      'aria-selected': selected ? 'true' : 'false',
      draggable: 'true',
      tabindex: '0',
    }, [
      iconButton(layer.visible ? 'eye' : 'eyeOff', layer.visible ? 'Hide layer' : 'Show layer', (event) => {
        event.stopPropagation();
        store.apply(layer.visible ? 'Hide layer' : 'Show layer', (doc) => updateLayer(doc, layer.id, { visible: !layer.visible }));
      }, 'layer-toggle'),
      this.thumb(layer),
      el('span', { className: 'layer-text' }, [name, el('span', { className: 'layer-kind', textContent: describeLayer(layer) })]),
      iconButton(layer.locked ? 'lock' : 'unlock', layer.locked ? 'Unlock layer' : 'Lock layer', (event) => {
        event.stopPropagation();
        store.apply(layer.locked ? 'Unlock layer' : 'Lock layer', (doc) => updateLayer(doc, layer.id, { locked: !layer.locked }));
      }, `layer-toggle${layer.locked ? ' is-on' : ''}`),
    ]);

    element.addEventListener('click', (event) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        store.select(selected ? store.selection.filter((id) => id !== layer.id) : [...store.selection, layer.id]);
      } else {
        store.select([layer.id]);
      }
    });
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        store.select([layer.id]);
      }
    });
    name.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      this.rename(layer, name);
    });

    element.addEventListener('dragstart', (event) => {
      this.dragId = layer.id;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', layer.id);
    });
    element.addEventListener('dragover', (event) => {
      if (!this.dragId || this.dragId === layer.id) {
        return;
      }

      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const above = event.clientY < rect.top + rect.height / 2;

      element.classList.toggle('drop-above', above);
      element.classList.toggle('drop-below', !above);
    });
    element.addEventListener('dragleave', () => element.classList.remove('drop-above', 'drop-below'));
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const above = element.classList.contains('drop-above');
      const dragId = this.dragId;

      element.classList.remove('drop-above', 'drop-below');
      this.dragId = null;

      if (!dragId || dragId === layer.id) {
        return;
      }

      store.apply('Reorder layer', (doc) => {
        const from = doc.layers.findIndex((entry) => entry.id === dragId);
        const target = doc.layers.findIndex((entry) => entry.id === layer.id);
        const reduced = from < target ? target - 1 : target;

        // "Above" in the list means higher in the stack, i.e. a larger index.
        return moveLayer(doc, dragId, above ? reduced + 1 : reduced);
      });
    });
    element.addEventListener('dragend', () => {
      this.dragId = null;
    });

    return element;
  }

  rename(layer, label) {
    const input = el('input', { type: 'text', className: 'layer-name-input', 'aria-label': 'Layer name' });
    let done = false;
    const commit = (save) => {
      if (done) {
        return;
      }

      done = true;
      const value = input.value.trim();

      input.replaceWith(label);
      this.signature = '';

      if (save && value && value !== layer.name) {
        this.app.store.apply('Rename layer', (doc) => updateLayer(doc, layer.id, { name: value }));
      } else {
        this.render();
      }
    };

    input.value = layer.name;
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();

      if (event.key === 'Enter') {
        commit(true);
      } else if (event.key === 'Escape') {
        commit(false);
      }
    });
    input.addEventListener('blur', () => commit(true));
    label.replaceWith(input);
    input.focus();
    input.select();
  }
}
