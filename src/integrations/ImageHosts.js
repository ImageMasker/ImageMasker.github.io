// Places the finished picture can be uploaded to. Imgur is blocked in the UK, so there are
// alternatives that also accept uploads straight from a browser (CORS enabled).
//
// RIS checks only need the picture online for a minute, so in the UK (where Imgur is blocked)
// they go to Litterbox for one hour, and anywhere else they fall back to it when the chosen host
// fails. Nothing goes to PictureGame's own servers: whoever runs them could see rounds before
// they are posted.

import { ImgurUploader } from './ImgurUploader.js';

const HOST_KEY = 'imagemasker.imageHost';
const IMGBB_KEY = 'imagemasker.imgbbKey';
// The UK and the Crown dependencies. The time zone is the only location hint that needs no request.
const UK_TIME_ZONES = new Set(['Europe/London', 'Europe/Belfast', 'Europe/Jersey', 'Europe/Guernsey', 'Europe/Isle_of_Man', 'GB', 'GB-Eire']);

export function inUk() {
  try {
    return UK_TIME_ZONES.has(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return false;
  }
}

function extension(blob) {
  return blob.type === 'image/jpeg' ? 'jpg' : 'png';
}

export class ImageHosts {
  constructor(settings) {
    this.imgur = new ImgurUploader(settings);
    this.hosts = [
      { id: 'imgur', label: 'Imgur', note: 'Not available in the UK.' },
      { id: 'imgbb', label: 'ImgBB', note: 'Needs a free API key from api.imgbb.com (saved in this browser).' },
      { id: 'litterbox', label: 'Litterbox (3 days)', note: 'No account needed, but the link stops working after 72 hours.' },
      // Only used for RIS checks, never offered in the host list.
      { id: 'litterbox-1h', label: 'Litterbox (1 hour)', note: '', hidden: true },
    ];
  }

  /** Hosts the user can pick. */
  choices() {
    return this.hosts.filter((host) => !host.hidden);
  }

  getHostId() {
    const stored = localStorage.getItem(HOST_KEY);

    if (this.choices().some((host) => host.id === stored)) {
      return stored;
    }

    return inUk() ? 'litterbox' : 'imgur';
  }

  /** Where RIS checks upload to: Litterbox for an hour instead of Imgur in the UK, or of Litterbox for 3 days. */
  risHostId() {
    const chosen = this.getHostId();

    return chosen === 'litterbox' || (chosen === 'imgur' && inUk()) ? 'litterbox-1h' : chosen;
  }

  /**
   * Uploads for a RIS check. If the host fails (Imgur blocked or rate limited, ImgBB key missing,
   * ...) it tries Litterbox for one hour before giving up. Resolves to { url, hostId }.
   */
  async uploadForRis(blob, onFallback = () => {}) {
    const hostId = this.risHostId();

    try {
      return { url: await this.upload(blob, hostId), hostId };
    } catch (error) {
      if (hostId === 'litterbox-1h') {
        throw error;
      }

      onFallback(this.getHost(hostId).label, error);
      return { url: await this.upload(blob, 'litterbox-1h'), hostId: 'litterbox-1h' };
    }
  }

  setHostId(id) {
    localStorage.setItem(HOST_KEY, id);
  }

  getHost(id = this.getHostId()) {
    return this.hosts.find((host) => host.id === id) ?? this.hosts[0];
  }

  getImgbbKey() {
    return localStorage.getItem(IMGBB_KEY) ?? '';
  }

  setImgbbKey(key) {
    if (key) {
      localStorage.setItem(IMGBB_KEY, key);
    } else {
      localStorage.removeItem(IMGBB_KEY);
    }
  }

  /** Uploads to the chosen host and resolves to a direct image URL. */
  async upload(blob, hostId = this.getHostId()) {
    if (hostId === 'imgbb') {
      return this.uploadImgbb(blob);
    }

    if (hostId === 'litterbox') {
      return this.uploadLitterbox(blob, '72h');
    }

    if (hostId === 'litterbox-1h') {
      return this.uploadLitterbox(blob, '1h');
    }

    return (await this.imgur.upload(blob)).url;
  }

  async uploadImgbb(blob) {
    const key = this.getImgbbKey().trim();

    if (!key) {
      throw new Error('Add your ImgBB API key first (Share → Upload settings).');
    }

    const form = new FormData();

    form.append('image', blob, `round.${extension(blob)}`);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, { method: 'POST', body: form });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.data?.url) {
      throw new Error(data?.error?.message || `Upload failed (${response.status})`);
    }

    return data.data.url;
  }

  /** Temporary anonymous upload; `time` is 1h, 12h, 24h or 72h. */
  async uploadLitterbox(blob, time = '72h') {
    const form = new FormData();

    form.append('reqtype', 'fileupload');
    form.append('time', time);
    form.append('fileToUpload', blob, `round.${extension(blob)}`);

    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form });
    const text = (await response.text()).trim();

    if (!response.ok || !/^https:\/\/\S+$/.test(text)) {
      throw new Error(text.slice(0, 120) || `Upload failed (${response.status})`);
    }

    return text;
  }
}
