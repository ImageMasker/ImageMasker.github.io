// Decoded images used by layers. Assets are referenced by id from the document, so undo/redo and
// sessions never copy pixel data around.

import { getCorsImageSourceCandidates } from '../integrations/CorsProxy.js';
import { renderFlagMaskToCanvas } from '../masks/FlagMaskRenderer.js';
import { loadImageElement } from '../utils/image.js';
import { uid } from './model.js';

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image data.'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

export class AssetStore {
  constructor() {
    this.assets = new Map();
    this.maxSize = 8192;
    this.flagCatalog = null;
  }

  get(id) {
    return this.assets.get(id) ?? null;
  }

  register(asset) {
    this.assets.set(asset.id, asset);
    return asset;
  }

  async decode(blob) {
    let source;

    try {
      source = await createImageBitmap(blob);
    } catch {
      const objectUrl = URL.createObjectURL(blob);

      try {
        source = await loadImageElement(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    return this.fit(source);
  }

  /** Downscales sources that exceed the largest texture the GPU can hold. */
  fit(source) {
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;

    if (!width || !height) {
      throw new Error('Loaded image has invalid dimensions.');
    }

    const scale = Math.min(1, this.maxSize / Math.max(width, height));

    if (scale >= 1) {
      return { source, width, height, downscaled: false };
    }

    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return { source: canvas, width: canvas.width, height: canvas.height, downscaled: true };
  }

  async fromBlob(blob, { id = uid('asset'), name = '', url = '' } = {}) {
    const decoded = await this.decode(blob);

    return this.register({ id, kind: 'blob', blob, name, url, ...decoded });
  }

  /** Loads a remote image, falling back to the CORS proxy when the host does not allow it. */
  async fromUrl(url, options = {}) {
    const errors = [];

    for (const candidate of getCorsImageSourceCandidates(url)) {
      try {
        const response = await fetch(candidate, { mode: 'cors' });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        return await this.fromBlob(blob, { ...options, url });
      } catch (error) {
        errors.push(error?.message || 'failed');
      }
    }

    throw new Error(`Failed to load image: ${url} (${errors.join(' | ')})`);
  }

  /** Bundled image (preset masks). Identified by path so sessions can re-resolve it. */
  async fromPath(path, { name = '' } = {}) {
    const id = `path:${path}`;
    const existing = this.get(id);

    if (existing) {
      return existing;
    }

    const image = await loadImageElement(path);
    return this.register({ id, kind: 'path', path, name, ...this.fit(image) });
  }

  async fromFlag(flag) {
    const id = `flag:${flag.id}`;
    const existing = this.get(id);

    if (existing) {
      return existing;
    }

    const canvas = await renderFlagMaskToCanvas(flag);
    return this.register({ id, kind: 'flag', flagId: flag.id, name: flag.name, ...this.fit(canvas) });
  }

  fromCanvas(canvas, { id = uid('asset'), name = '' } = {}) {
    return this.register({ id, kind: 'canvas', name, ...this.fit(canvas) });
  }

  /** Storable description of an asset. Blobs stay blobs (IndexedDB) unless `inline` is set (JSON). */
  async serialize(id, { inline = false } = {}) {
    const asset = this.get(id);

    if (!asset) {
      return null;
    }

    if (asset.kind === 'path') {
      return { id, kind: 'path', path: asset.path, name: asset.name };
    }

    if (asset.kind === 'flag') {
      return { id, kind: 'flag', flagId: asset.flagId, name: asset.name };
    }

    let blob = asset.blob;

    if (!blob) {
      const canvas = document.createElement('canvas');

      canvas.width = asset.width;
      canvas.height = asset.height;
      canvas.getContext('2d').drawImage(asset.source, 0, 0);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    }

    return {
      id,
      kind: 'blob',
      name: asset.name,
      url: asset.url || '',
      ...(inline ? { dataUrl: await blobToDataUrl(blob) } : { blob }),
    };
  }

  async restore(record) {
    if (!record?.id) {
      return null;
    }

    if (this.get(record.id)) {
      return this.get(record.id);
    }

    if (record.kind === 'path') {
      return this.fromPath(record.path, { name: record.name });
    }

    if (record.kind === 'flag') {
      const flag = (await this.flagCatalog?.())?.findById(record.flagId);

      if (!flag) {
        throw new Error(`Unknown flag mask: ${record.flagId}`);
      }

      return this.fromFlag(flag);
    }

    const options = { id: record.id, name: record.name, url: record.url };

    if (record.blob) {
      return this.fromBlob(record.blob, options);
    }

    if (record.dataUrl) {
      return this.fromBlob(await dataUrlToBlob(record.dataUrl), options);
    }

    if (record.url) {
      return this.fromUrl(record.url, options);
    }

    throw new Error('The saved image data is missing.');
  }
}
