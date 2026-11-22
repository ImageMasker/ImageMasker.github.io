// Client for the custom mask store on media.picturega.me (picturegame-media-gateway, masks.mjs).
//
// There are no accounts. Each browser gets a random "mask key" the first time it uploads; the
// server keeps only its hash and serves private masks only to that key. Copy the key to another
// device (Settings → Masks) to see the same masks there. Moderators also store the moderator
// token here to review community submissions.
//
// The server can be pointed elsewhere for testing: localStorage['imagemasker.mediaServer'].

const KEY_STORAGE = 'imagemasker.maskKey';
const MOD_STORAGE = 'imagemasker.maskModToken';
const SERVER_STORAGE = 'imagemasker.mediaServer';
const DEFAULT_SERVER = 'https://media.picturega.me';
const KEY_PATTERN = /^mk_[A-Za-z0-9_-]{43}$/;

function read(key) {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key, value) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: the key only lasts for this visit.
  }
}

function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `mk_${base64}`;
}

export class MaskServer {
  constructor() {
    this.sessionKey = '';
  }

  get base() {
    const custom = read(SERVER_STORAGE).trim().replace(/\/+$/, '');

    return /^https?:\/\//.test(custom) ? custom : DEFAULT_SERVER;
  }

  get host() {
    return new URL(this.base).host;
  }

  hasKey() {
    return KEY_PATTERN.test(read(KEY_STORAGE) || this.sessionKey);
  }

  /** This browser's mask key, made on first use. */
  key() {
    let key = read(KEY_STORAGE) || this.sessionKey;

    if (!KEY_PATTERN.test(key)) {
      key = newKey();
      write(KEY_STORAGE, key);
      this.sessionKey = key;
    }

    return key;
  }

  /** Uses a key copied from another device. */
  setKey(value) {
    const key = String(value ?? '').trim();

    if (!KEY_PATTERN.test(key)) {
      throw new Error('That is not a mask key. It starts with mk_ and is 46 characters long.');
    }

    write(KEY_STORAGE, key);
    this.sessionKey = key;
  }

  get modToken() {
    return read(MOD_STORAGE);
  }

  set modToken(value) {
    write(MOD_STORAGE, String(value ?? '').trim());
  }

  async call(path, { method = 'GET', body = null, headers = {}, auth = 'key', as = 'json' } = {}) {
    const token = auth === 'key' ? this.key() : auth === 'mod' ? this.modToken : '';
    let response;

    try {
      response = await fetch(`${this.base}${path}`, {
        method,
        body,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        cache: 'no-store',
      });
    } catch {
      throw new Error(`Could not reach ${this.host}. Check your connection and try again.`);
    }

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const reason = data?.error && data.error !== 'internal_error' ? data.error : `error ${response.status}`;

      throw Object.assign(new Error(`${this.host}: ${reason}.`), { status: response.status });
    }

    return as === 'blob' ? response.blob() : response.json();
  }

  json(value) {
    return { body: JSON.stringify(value), headers: { 'Content-Type': 'application/json' } };
  }

  // ── your masks ──────────────────────────────────────────────────────────

  async list() {
    return (await this.call('/api/v1/masks')).masks;
  }

  upload(blob, name) {
    return this.call(`/api/v1/masks?name=${encodeURIComponent(name || 'Mask')}`, {
      method: 'POST',
      body: blob,
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    });
  }

  file(id) {
    return this.call(`/api/v1/masks/${id}/file`, { as: 'blob' });
  }

  remove(id) {
    return this.call(`/api/v1/masks/${id}`, { method: 'DELETE' });
  }

  rename(id, name) {
    return this.call(`/api/v1/masks/${id}`, { method: 'PATCH', ...this.json({ name }) });
  }

  submit(id, { name, author }) {
    return this.call(`/api/v1/masks/${id}/submit`, { method: 'POST', ...this.json({ name, author }) });
  }

  // ── community ───────────────────────────────────────────────────────────

  async community() {
    return (await this.call('/api/v1/community-masks', { auth: 'none' })).masks;
  }

  // ── moderation ──────────────────────────────────────────────────────────

  async reviewQueue(status = 'pending') {
    return (await this.call(`/api/v1/masks/review?status=${encodeURIComponent(status)}`, { auth: 'mod' })).masks;
  }

  reviewFile(id) {
    return this.call(`/api/v1/masks/${id}/file`, { auth: 'mod', as: 'blob' });
  }

  decide(id, decision) {
    return this.call(`/api/v1/masks/${id}/review`, { method: 'POST', auth: 'mod', ...this.json({ decision }) });
  }

  removeAsModerator(id) {
    return this.call(`/api/v1/masks/${id}`, { method: 'DELETE', auth: 'mod' });
  }
}
