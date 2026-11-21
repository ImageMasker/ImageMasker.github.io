// Background removal and prompt-based AI edits. Both capture part of the picture, send it to a
// model and put the result back as a new image layer.

import { layerBounds } from '../core/geometry.js';
import { imageLayer, insertLayer, selectionBounds, updateLayer } from '../core/model.js';
import { AiImageEditor } from '../integrations/AiImageEditor.js';
import { BackgroundRemover } from '../integrations/BackgroundRemover.js';
import { AiEditPanel } from '../ui/AiEditPanel.js';
import { BackgroundRemovalPanel } from '../ui/BackgroundRemovalPanel.js';
import { el } from '../utils/dom.js';

function progressLabel(key, current = 0, total = 0) {
  if (typeof key !== 'string') {
    return 'Removing background';
  }

  if (key.startsWith('fetch:')) {
    const name = key.replace('fetch:', '');
    return total > 0 ? `Downloading ${name} (${Math.round((current / total) * 100)}%)` : `Downloading ${name}`;
  }

  return {
    'compute:decode': 'Decoding image',
    'compute:inference': 'Running model',
    'compute:mask': 'Building mask',
    'compute:encode': 'Encoding cutout',
  }[key] ?? 'Removing background';
}

export class AiTools {
  constructor(app) {
    this.app = app;
    this.editor = new AiImageEditor();
    this.remover = new BackgroundRemover();
    this.editPanel = new AiEditPanel();
    this.removalPanel = new BackgroundRemovalPanel();
    this.editCount = 0;
    this.removalCount = 0;
    this.element = el('div', { className: 'ai-panel' }, [this.removalPanel.element, this.editPanel.element]);
    this.bind();
  }

  async init() {
    const refs = this.editPanel.refs;
    const saved = this.settings();
    const serviceId = saved.serviceId || 'aiStudio';
    const service = saved.services?.[serviceId] ?? {};

    refs.serviceSelect.value = serviceId;
    refs.sourceSelect.value = saved.sourceMode || 'visible-layers';
    refs.promptInput.value = saved.prompt || '';
    refs.tokenInput.value = service.token || '';
    refs.customUrlInput.value = service.customUrl || '';
    this.editPanel.setServiceMeta(this.editor.getServiceDefinition(serviceId));
    await this.loadModels({ preferred: service.model || '', announce: false });
  }

  settings() {
    const stored = this.app.settings.getAiEditSettings();
    return stored && typeof stored === 'object' ? stored : {};
  }

  serviceState(serviceId) {
    return this.settings().services?.[serviceId] ?? {};
  }

  persist() {
    const refs = this.editPanel.refs;
    const current = this.settings();
    const serviceId = refs.serviceSelect.value;

    this.app.settings.setAiEditSettings({
      ...current,
      serviceId,
      sourceMode: refs.sourceSelect.value,
      prompt: refs.promptInput.value,
      services: {
        ...(current.services ?? {}),
        [serviceId]: {
          ...(current.services?.[serviceId] ?? {}),
          token: refs.tokenInput.value.trim(),
          customUrl: refs.customUrlInput.value.trim(),
          model: refs.modelSelect.value,
        },
      },
    });
  }

  bind() {
    const refs = this.editPanel.refs;

    this.removalPanel.refs.button.addEventListener('click', () => this.removeBackground());
    refs.serviceSelect.addEventListener('change', async () => {
      const state = this.serviceState(refs.serviceSelect.value);

      refs.tokenInput.value = state.token || '';
      refs.customUrlInput.value = state.customUrl || '';
      this.editPanel.setServiceMeta(this.editor.getServiceDefinition(refs.serviceSelect.value));
      this.persist();
      await this.loadModels({ preferred: state.model || '' });
    });
    refs.sourceSelect.addEventListener('change', () => this.persist());
    refs.modelSelect.addEventListener('change', () => this.persist());
    refs.promptInput.addEventListener('input', () => {
      this.editPanel.setMessage('');
      this.persist();
    });
    refs.tokenInput.addEventListener('change', async () => {
      this.persist();

      if (refs.serviceSelect.value !== 'comfyUi') {
        await this.loadModels({ preferred: this.serviceState(refs.serviceSelect.value).model || refs.modelSelect.value, announce: false });
      }
    });
    refs.customUrlInput.addEventListener('change', async () => {
      this.persist();

      if (refs.serviceSelect.value === 'comfyUi') {
        await this.loadModels({ preferred: this.serviceState(refs.serviceSelect.value).model || refs.modelSelect.value });
      }
    });
    refs.refreshModelsButton.addEventListener('click', () => this.loadModels({ preferred: refs.modelSelect.value }));
    refs.generateButton.addEventListener('click', () => this.generate());
  }

  async loadModels({ preferred = '', announce = true } = {}) {
    const refs = this.editPanel.refs;

    refs.refreshModelsButton.disabled = true;
    this.editPanel.setMessage('');

    try {
      const models = await this.editor.listModels({
        serviceId: refs.serviceSelect.value,
        token: refs.tokenInput.value.trim(),
        customUrl: refs.customUrlInput.value.trim(),
      });

      this.editPanel.setModels(models, preferred);
      this.persist();
    } catch (error) {
      this.editPanel.setModels([], '');
      this.editPanel.setMessage(error.message, 'error');

      if (announce) {
        this.app.notify(error.message, 'error', 3600);
      }
    } finally {
      refs.refreshModelsButton.disabled = false;
    }
  }

  clampRect(rect) {
    const doc = this.app.store.doc;
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const right = Math.min(doc.width, Math.ceil(rect.x + rect.width));
    const bottom = Math.min(doc.height, Math.ceil(rect.y + rect.height));

    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
  }

  /** PNG data URL of `rect` from a render of the document (optionally a single layer). */
  capture(rect, onlyLayerId = null) {
    const { store, stage } = this.app;
    const full = stage.renderToCanvas(store.doc, { scale: 1, only: onlyLayerId ? new Set([onlyLayerId]) : null });
    const scale = full.width / store.doc.width;
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    canvas.getContext('2d').drawImage(full, -Math.round(rect.x * scale), -Math.round(rect.y * scale));
    return canvas.toDataURL('image/png');
  }

  captureEditSource(mode) {
    const { store } = this.app;
    const doc = store.doc;
    let rect = { x: 0, y: 0, width: doc.width, height: doc.height };
    let only = null;

    if (mode === 'selected-layer') {
      const layer = store.selectedLayer;

      if (!layer || layer.type === 'drawing' || layer.type === 'effect') {
        throw new Error('Select an image, mask, text or shape layer first.');
      }

      only = layer.id;
      rect = layerBounds(layer);
    } else if (mode === 'selection-bounds') {
      const bounds = selectionBounds(doc, store.selection);

      if (!bounds) {
        throw new Error('Select something on the canvas to use selection bounds.');
      }

      rect = bounds;
    }

    rect = this.clampRect(rect);

    if (!rect.width || !rect.height) {
      throw new Error('The selected source area is empty.');
    }

    return { imageDataUrl: this.capture(rect, only), mimeType: 'image/png', rect };
  }

  async resultBlob(result) {
    if (result?.imageBlob instanceof Blob) {
      return result.imageBlob;
    }

    const url = result?.imageDataUrl || result?.imageUrl;

    if (!url) {
      throw new Error('The AI service returned no usable image.');
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('The generated image could not be downloaded.');
    }

    return response.blob();
  }

  async generate() {
    const app = this.app;
    const refs = this.editPanel.refs;

    if (!app.requireImage('Load an image before using AI editing.')) {
      return;
    }

    if (!refs.modelSelect.value) {
      this.editPanel.setMessage('Select a model first.', 'warning');
      return;
    }

    this.editPanel.setBusy(true, 'Generating');
    this.editPanel.setMessage('');

    try {
      const source = this.captureEditSource(refs.sourceSelect.value);
      const result = await this.editor.editImage({
        serviceId: refs.serviceSelect.value,
        modelId: refs.modelSelect.value,
        prompt: refs.promptInput.value.trim(),
        token: refs.tokenInput.value.trim(),
        customUrl: refs.customUrlInput.value.trim(),
        imageDataUrl: source.imageDataUrl,
        mimeType: source.mimeType,
      });
      const asset = await app.assets.fromBlob(await this.resultBlob(result), { name: 'AI edit' });
      const layer = imageLayer(app.store.doc, asset, { name: `AI Edit ${(this.editCount += 1)}`, rect: source.rect });

      app.store.apply('AI edit', (doc) => insertLayer(doc, layer));
      app.store.select([layer.id]);
      app.setTool('select');
      this.persist();
      this.editPanel.setMessage('Edited layer generated.', 'success');
      app.notify('AI edit completed.', 'success');
    } catch (error) {
      this.editPanel.setMessage(error.message, 'error');
      app.notify(error.message, 'error', 4200);
    } finally {
      this.editPanel.setBusy(false);
    }
  }

  async removeBackground() {
    const app = this.app;
    const panel = this.removalPanel;

    if (!app.requireImage('Load an image before removing a background.')) {
      return;
    }

    panel.setBusy(true, 'Preparing');
    panel.setMessage('');

    try {
      const doc = app.store.doc;
      const target = app.store.selectedLayer ?? doc.layers.find((layer) => layer.type === 'image' && layer.base);

      if (!target || target.type === 'effect' || target.type === 'drawing') {
        throw new Error('Select an image layer first.');
      }

      const rect = this.clampRect(layerBounds(target));

      if (!rect.width || !rect.height) {
        throw new Error('The selected layer has no visible area to process.');
      }

      const blob = await this.remover.removeBackground(this.capture(rect, target.id), {
        onProgress: (key, current, total) => panel.setBusy(true, progressLabel(key, current, total)),
      });
      const asset = await app.assets.fromBlob(blob, { name: 'Cutout' });
      const count = (this.removalCount += 1);
      const layer = imageLayer(doc, asset, { name: `${target.name} cutout${count > 1 ? ` ${count}` : ''}`, rect });

      app.store.apply('Remove background', (current) => {
        const index = current.layers.findIndex((entry) => entry.id === target.id);

        return insertLayer(updateLayer(current, target.id, { visible: false }), layer, index + 1);
      });
      app.store.select([layer.id]);
      app.setTool('select');
      panel.setMessage('Background removed into a new layer.', 'success');
      app.notify('Background removal completed.', 'success');
    } catch (error) {
      panel.setMessage(error.message, 'error');
      app.notify(error.message, 'error', 4200);
    } finally {
      panel.setBusy(false);
    }
  }
}
