// Places the finished picture can be uploaded to. Imgur is blocked in the UK, so there are
// alternatives that also accept uploads straight from a browser (CORS enabled).

import { ImgurUploader } from './ImgurUploader.js';

const HOST_KEY = 'imagemasker.imageHost';
const IMGBB_KEY = 'imagemasker.imgbbKey';

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
    ];
  }

  getHostId() {
    const stored = localStorage.getItem(HOST_KEY);

    return this.hosts.some((host) => host.id === stored) ? stored : 'imgur';
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
