// The user's own mask images, kept in this browser (IndexedDB, next to the sessions). A mask can
// also have a private copy on media.picturega.me (`remoteId`), and that copy can be submitted to
// the community list (`remoteStatus`: private, pending, approved or rejected).

import { uid } from '../core/model.js';

const MAX_SIDE = 4096;
const MAX_BYTES = 8 * 1024 * 1024;
const KEPT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function request(operation) {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}

async function decode(blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    // SVG and a few other formats only decode through an <img>.
    const url = URL.createObjectURL(blob);

    try {
      const image = new Image();

      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const encode = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Turns any image file into one the media server accepts: PNG, JPEG or WebP, at most 4096 px a
 * side and 8 MB. Files that already fit are kept byte for byte.
 */
export async function prepareMaskImage(file) {
  const source = await decode(file);
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;

  if (!width || !height) {
    throw new Error('That file is not an image.');
  }

  if (KEPT_TYPES.has(file.type) && file.size <= MAX_BYTES && width <= MAX_SIDE && height <= MAX_SIDE) {
    return { blob: file, width, height };
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);

  // Masks usually need their transparency, so PNG first, then WebP if PNG is too big.
  let blob = await encode(canvas, 'image/png');

  if (!blob || blob.size > MAX_BYTES) {
    blob = await encode(canvas, 'image/webp', 0.92);
  }

  if (!blob || blob.size > MAX_BYTES) {
    throw new Error('That image is too large to use as a mask, even scaled down.');
  }

  return { blob, width: canvas.width, height: canvas.height };
}

/** "my leaves (2).png" → "my leaves (2)" */
export function maskNameFromFile(file) {
  return String(file?.name ?? '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 60) || 'Mask';
}

/** "https://example.com/img/my_leaves.png?w=200" → "my_leaves.png" (maskNameFromFile makes it "my leaves") */
function fileNameFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '') || 'Mask';
  } catch {
    return 'Mask';
  }
}

// Hosts that do not allow cross-origin reads are fetched through wsrv.nl, an image-only proxy and
// CDN that sends CORS headers and passes PNG transparency through.
const imageProxy = (url) => `https://wsrv.nl/?url=${encodeURIComponent(url)}`;

/**
 * Downloads an image link so it can be kept like a file the user picked. The link itself is not
 * kept: links break (Discord's expire), the image does not.
 */
export async function fetchMaskImage(url) {
  const errors = [];

  for (const candidate of [url, imageProxy(url)]) {
    try {
      const response = await fetch(candidate, { mode: 'cors', cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`error ${response.status}`);
      }

      const blob = await response.blob();
      const type = blob.type.split(';')[0].trim().toLowerCase();

      if (/^(text|application\/json)/.test(type)) {
        throw new Error('not an image');
      }

      return new File([blob], fileNameFromUrl(url), { type: type.startsWith('image/') ? type : '' });
    } catch (error) {
      errors.push(error?.message || 'failed');
    }
  }

  throw new Error(`That link could not be loaded (${[...new Set(errors)].join(', ')}). Use a link that opens the image itself.`);
}

export class CustomMasks {
  constructor(sessionStore) {
    this.sessionStore = sessionStore;
  }

  async store(mode) {
    const database = await this.sessionStore.open();

    return database.transaction('masks', mode).objectStore('masks');
  }

  async list() {
    const all = await request((await this.store('readonly')).getAll());

    return all.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  async get(id) {
    return (await request((await this.store('readonly')).get(id))) ?? null;
  }

  async add({ blob, name, width, height, remoteId = null, remoteStatus = null }) {
    const mask = {
      id: uid('mask'),
      name: name || 'Mask',
      blob,
      width,
      height,
      createdAt: new Date().toISOString(),
      remoteId,
      remoteStatus,
    };

    await request((await this.store('readwrite')).put(mask));
    void navigator.storage?.persist?.().catch(() => {});
    return mask;
  }

  async update(id, patch) {
    const store = await this.store('readwrite');
    const mask = await request(store.get(id));

    if (!mask) {
      return null;
    }

    const next = { ...mask, ...patch };

    await request(store.put(next));
    return next;
  }

  async remove(id) {
    await request((await this.store('readwrite')).delete(id));
  }
}
