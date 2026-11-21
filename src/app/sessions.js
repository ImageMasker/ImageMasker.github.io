// Saving and restoring work. Sessions live in IndexedDB so local images survive a reload;
// picture data is stored once per session and only rewritten when it changes.

import { createDoc, fitText } from '../core/model.js';
import { getEffect, hasEffect, normalizeParams } from '../gl/effects.js';
import { getPattern, hasPattern } from '../gl/patterns.js';

const DB_NAME = 'imagemasker-v3';
const AUTOSAVE_ID = 'autosave';
export const SESSION_VERSION = 3;

function request(operation) {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}

export class SessionStore {
  constructor() {
    this.database = null;
  }

  async open() {
    if (!this.database) {
      const opening = indexedDB.open(DB_NAME, 1);

      opening.onupgradeneeded = () => {
        opening.result.createObjectStore('sessions', { keyPath: 'id' });
        opening.result.createObjectStore('assets');
      };
      this.database = await request(opening);
    }

    return this.database;
  }

  async stores(mode) {
    const transaction = (await this.open()).transaction(['sessions', 'assets'], mode);

    return {
      sessions: transaction.objectStore('sessions'),
      assets: transaction.objectStore('assets'),
      done: new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }),
    };
  }

  assetRange(sessionId) {
    return IDBKeyRange.bound(`${sessionId}/`, `${sessionId}/\uffff`);
  }

  /** `assetRecords` maps asset id → storable record; unchanged assets are not rewritten. */
  async save(session, assetRecords) {
    const existing = new Set(await request((await this.stores('readonly')).assets.getAllKeys(this.assetRange(session.id))));
    const { sessions, assets, done } = await this.stores('readwrite');
    const wanted = new Set();

    for (const [assetId, record] of assetRecords) {
      const key = `${session.id}/${assetId}`;

      wanted.add(key);

      if (!existing.has(key)) {
        assets.put(record, key);
      }
    }

    for (const key of existing) {
      if (!wanted.has(key)) {
        assets.delete(key);
      }
    }

    sessions.put(session);
    await done;
  }

  async load(sessionId) {
    const { sessions, assets } = await this.stores('readonly');
    const session = await request(sessions.get(sessionId));

    if (!session) {
      return null;
    }

    return { session, assets: await request(assets.getAll(this.assetRange(sessionId))) };
  }

  async remove(sessionId) {
    const { sessions, assets, done } = await this.stores('readwrite');

    sessions.delete(sessionId);
    assets.delete(this.assetRange(sessionId));
    await done;
  }

  async list() {
    const { sessions } = await this.stores('readonly');
    const all = await request(sessions.getAll());

    return all
      .filter((session) => session.id !== AUTOSAVE_ID)
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async hasAutosave() {
    const { sessions } = await this.stores('readonly');

    return Boolean(await request(sessions.getKey(AUTOSAVE_ID)));
  }
}

export { AUTOSAVE_ID };

function usedAssetIds(doc) {
  return [...new Set(doc.layers.map((layer) => layer.assetId).filter(Boolean))];
}

/** Session payload without picture data, plus the list of assets it needs. */
export function describeSession(app) {
  const doc = app.store.doc;

  return {
    version: SESSION_VERSION,
    savedAt: new Date().toISOString(),
    doc,
    ui: app.sharePanel.getShareState(),
    assetIds: usedAssetIds(doc),
  };
}

/** Self-contained JSON: every picture is embedded as a data URL. */
export async function exportSessionJson(app) {
  const payload = describeSession(app);
  const assets = [];

  for (const id of payload.assetIds) {
    assets.push(await app.assets.serialize(id, { inline: true }));
  }

  return JSON.stringify({ app: 'imagemasker', ...payload, assets: assets.filter(Boolean) });
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Repairs anything a stale or hand-edited session might get wrong so the renderer never chokes. */
export function normalizeDoc(raw, hasAsset) {
  const doc = createDoc(finite(raw?.width, 1), finite(raw?.height, 1));
  const dropped = [];

  for (const source of Array.isArray(raw?.layers) ? raw.layers : []) {
    if (!source || typeof source !== 'object' || typeof source.id !== 'string') {
      continue;
    }

    let layer = {
      ...source,
      name: String(source.name ?? 'Layer'),
      visible: source.visible !== false,
      locked: source.locked === true,
      opacity: Math.max(0, Math.min(1, finite(source.opacity, 1))),
      blend: typeof source.blend === 'string' ? source.blend : 'normal',
      x: finite(source.x, doc.width / 2),
      y: finite(source.y, doc.height / 2),
      w: Math.max(1e-3, finite(source.w, doc.width)),
      h: Math.max(1e-3, finite(source.h, doc.height)),
      rotation: finite(source.rotation, 0),
      skewX: finite(source.skewX, 0),
      skewY: finite(source.skewY, 0),
    };

    if (layer.type === 'image' || (layer.type === 'mask' && layer.source !== 'pattern')) {
      if (!hasAsset(layer.assetId)) {
        dropped.push(layer.name);
        continue;
      }
    }

    if (layer.type === 'mask' && layer.source === 'pattern') {
      if (!hasPattern(layer.patternId)) {
        dropped.push(layer.name);
        continue;
      }

      layer.params = normalizeParams(getPattern(layer.patternId), layer.params);
    } else if (layer.type === 'effect') {
      if (!hasEffect(layer.effectId)) {
        dropped.push(layer.name);
        continue;
      }

      layer.params = normalizeParams(getEffect(layer.effectId), layer.params);
      layer.coverage = ['full', 'rect', 'ellipse', 'polygon', 'paint'].includes(layer.coverage) ? layer.coverage : 'full';
      layer.strokes = layer.coverage === 'paint' ? (Array.isArray(layer.strokes) ? layer.strokes : []) : null;

      if (layer.coverage === 'polygon' && !(Array.isArray(layer.points) && layer.points.length >= 6)) {
        layer.coverage = 'rect';
      }
    } else if (layer.type === 'drawing') {
      layer.strokes = Array.isArray(layer.strokes) ? layer.strokes : [];
    } else if (layer.type === 'text') {
      layer = fitText({ ...layer, text: String(layer.text ?? '') });
    } else if (!['image', 'mask', 'rect'].includes(layer.type)) {
      continue;
    }

    doc.layers.push(layer);
  }

  return { doc, dropped };
}

/**
 * Loads a session payload ({ doc, ui, assets }) into the editor.
 * Returns the names of layers that had to be dropped because their picture could not be restored.
 */
export async function restoreSession(app, payload) {
  if (payload?.background && !payload.doc) {
    throw new Error('This session was saved by the previous ImageMasker. Open it in the previous version (Settings → About).');
  }

  if (!payload || typeof payload !== 'object' || !payload.doc) {
    throw new Error('This file is not an ImageMasker session.');
  }

  const failed = [];

  for (const record of payload.assets ?? []) {
    try {
      await app.assets.restore(record);
    } catch (error) {
      failed.push(record?.name || record?.id);
    }
  }

  const { doc, dropped } = normalizeDoc(payload.doc, (id) => Boolean(app.assets.get(id)));

  if (!doc.layers.length) {
    throw new Error('The session has no layers that could be restored.');
  }

  app.replaceDocument(doc);
  app.sharePanel.setShareState(payload.ui ?? {});
  return dropped;
}
