// The Custom tab of the mask library: your own masks and the community list.
//
// * Your masks are image files kept in this browser (IndexedDB). Each can also get a private copy
//   on media.picturega.me, which follows your mask key to other devices, and that copy can be
//   submitted to the community list. A moderator approves submissions before anyone sees them.
// * Mask URLs saved by the previous version (localStorage 'masks') are still listed.
// * Community masks are loaded from media.picturega.me when the tab is first opened.

import { maskNameFromFile, prepareMaskImage } from '../storage/CustomMasks.js';
import { el } from '../utils/dom.js';
import { button, message, row, section, toggle } from './kit.js';
import { promptDialog } from './PromptDialog.js';

const CLOUD_COPY_KEY = 'imagemasker.maskCloudCopy';
const STARRED_KEY = 'imagemasker.starredMasks';
const STATUS_BADGE = {
  private: { kind: 'private', text: '☁', title: 'Private copy on the PictureGame media server' },
  pending: { kind: 'pending', text: 'In review', title: 'Submitted to the community list; a moderator will check it' },
  approved: { kind: 'approved', text: 'Shared', title: 'In the community list' },
  rejected: { kind: 'private', text: '☁', title: 'Private copy on the PictureGame media server (not accepted for the community list)' },
};

function preference(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function starredIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(STARRED_KEY) ?? '[]');

    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function setPreference(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Not remembered; fine.
  }
}

export class CustomMasksPanel {
  constructor(app, library) {
    this.app = app;
    this.library = library;
    this.masks = [];
    this.urls = new Map();
    this.community = null;
    this.communityBusy = false;
    this.lastSync = 0;
    this.missingRemote = [];
    this.element = this.render();
    void this.refresh();
  }

  get server() {
    return this.app.maskServer;
  }

  // ── layout ────────────────────────────────────────────────────────────────

  render() {
    this.grid = el('div', { className: 'mask-grid' });
    this.empty = el('div', { className: 'panel-empty-state', textContent: 'No masks yet. Add an image file: it is kept in this browser.' });
    this.notice = message();
    this.fileInput = el('input', { type: 'file', accept: 'image/*', multiple: '', className: 'visually-hidden', 'aria-label': 'Mask image files' });
    this.fileInput.addEventListener('change', () => {
      const files = [...(this.fileInput.files ?? [])];

      this.fileInput.value = '';
      void this.addFiles(files);
    });
    this.shareInput = el('input', { type: 'file', accept: 'image/*', className: 'visually-hidden', 'aria-label': 'Mask image to share' });
    this.shareInput.addEventListener('change', () => {
      const [file] = this.shareInput.files ?? [];

      this.shareInput.value = '';

      if (file) {
        void this.shareFile(file);
      }
    });
    this.cloudToggle = toggle({
      label: 'Private copy online',
      value: preference(CLOUD_COPY_KEY),
      onChange: (value) => setPreference(CLOUD_COPY_KEY, value),
    });
    this.cloudToggle.element.title = `New masks also get a private copy on ${this.server.host}, which only you can see (on any device with your mask key).`;
    this.syncButton = button('Get my masks from the server', { iconName: 'download', onClick: () => this.downloadMissing() });
    this.syncRow = row([this.syncButton], 'button-row--fill hidden');

    this.urlInput = el('input', { type: 'url', placeholder: 'https://… image URL', 'aria-label': 'Mask image URL' });
    this.urlInput.addEventListener('keydown', (event) => event.key === 'Enter' && this.saveUrl());

    this.communityGrid = el('div', { className: 'mask-grid' });
    this.communityStatus = el('div', { className: 'panel-empty-state', textContent: 'Loading community masks…' });
    this.communitySearch = el('input', { type: 'search', placeholder: 'Search community masks…', 'aria-label': 'Search community masks', className: 'library-search hidden' });
    this.communitySearch.addEventListener('input', () => this.renderCommunity());

    return el('div', { className: 'library-tab hidden' }, [
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: 'Your masks' }),
        this.empty,
        this.grid,
        el('div', { className: 'stack' }, [
          button('Add image files…', { iconName: 'upload', className: 'app-button--fill', onClick: () => this.fileInput.click() }),
          this.fileInput,
          this.shareInput,
          row([
            this.cloudToggle.element,
            button('Share a mask…', {
              iconName: 'grid',
              title: 'Pick an image to share in the community list. A moderator checks it first.',
              onClick: () => this.shareInput.click(),
            }),
          ], 'button-row--fill'),
          this.syncRow,
          this.notice.element,
          section('Mask from a URL', [
            el('div', { className: 'input-row' }, [this.urlInput, button('Save', { onClick: () => this.saveUrl() })]),
          ], { open: false }),
        ]),
      ]),
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: 'Community masks' }),
        el('p', {
          className: 'panel-intro-copy custom-masks-note',
          textContent: 'Shared by other players. ☆ stars one to keep it at the top (in this browser). Share yours with “Share a mask…” or a mask’s ⋯ menu; a moderator checks every mask first.',
        }),
        this.communitySearch,
        this.communityStatus,
        this.communityGrid,
        row([button('Refresh', { iconName: 'reset', onClick: () => this.loadCommunity(true) })], 'button-row--fill'),
      ]),
    ]);
  }

  /** Called when the Custom tab is shown. */
  shown() {
    void this.loadCommunity();

    if (Date.now() - this.lastSync > 2 * 60 * 1000) {
      void this.syncRemote();
    }
  }

  // ── your masks ──────────────────────────────────────────────────────────

  async refresh() {
    try {
      this.masks = await this.app.customMasks.list();
    } catch {
      this.masks = [];
      this.notice.set('Masks cannot be saved in this browser (private window?). You can still add a file for this picture only.', 'warning');
    }

    this.renderMine();
  }

  objectUrl(mask) {
    let url = this.urls.get(mask.id);

    if (!url) {
      url = URL.createObjectURL(mask.blob);
      this.urls.set(mask.id, url);
    }

    return url;
  }

  renderMine() {
    const legacy = this.app.maskStorage.getMasks();
    const known = new Set(this.masks.map((mask) => mask.id));

    for (const [id, url] of this.urls) {
      if (!known.has(id)) {
        URL.revokeObjectURL(url);
        this.urls.delete(id);
      }
    }

    this.empty.classList.toggle('hidden', this.masks.length + legacy.length > 0);
    this.grid.replaceChildren(
      ...this.masks.map((mask) =>
        this.library.tile({
          label: mask.name,
          title: `${mask.name} · ${mask.width} × ${mask.height}`,
          image: this.objectUrl(mask),
          badge: STATUS_BADGE[mask.remoteStatus] ?? null,
          onPick: (options) => this.app.addBlobMask(mask.blob, mask.name, options),
          menu: () => this.menuFor(mask),
        })
      ),
      ...legacy.map((url, index) =>
        this.library.tile({
          label: `Link ${index + 1}`,
          title: url,
          image: url,
          onPick: (options) => this.app.addCustomMask(url, options),
          menu: () => [
            { label: 'Add as a new layer', icon: 'plus', action: () => this.app.addCustomMask(url, { stack: true }) },
            { label: 'Copy the link', icon: 'clipboard', action: () => this.app.copyText(url, 'Mask link copied.') },
            'separator',
            {
              label: 'Remove',
              icon: 'trash',
              action: () => {
                this.app.maskStorage.removeMask(url);
                this.renderMine();
              },
            },
          ],
        })
      )
    );
    this.syncRow.classList.toggle('hidden', !this.missingRemote.length);
    this.syncButton.querySelector('span:last-child').textContent = `Get ${this.missingRemote.length} mask${this.missingRemote.length === 1 ? '' : 's'} from ${this.server.host}`;
  }

  menuFor(mask) {
    const status = mask.remoteStatus;
    const online = Boolean(mask.remoteId);
    const host = this.server.host;

    return [
      { label: 'Add as a new layer', icon: 'plus', action: () => this.app.addBlobMask(mask.blob, mask.name, { stack: true }) },
      { label: 'Add as a repeated pattern (like a flag)', icon: 'grid', action: () => this.app.addBlobMask(mask.blob, mask.name, { stack: true, repeat: true }) },
      { label: 'Rename…', icon: 'pencil', action: () => this.rename(mask) },
      { label: 'Download', icon: 'download', action: () => this.download(mask) },
      'separator',
      online
        ? { label: `Private copy on ${host}`, icon: 'bookmark', disabled: true }
        : { label: `Keep a private copy on ${host}`, icon: 'upload', action: () => this.uploadPrivately(mask) },
      status === 'pending'
        ? { label: 'Waiting for a moderator', icon: 'search', disabled: true }
        : status === 'approved'
          ? { label: 'In the community list', icon: 'grid', disabled: true }
          : { label: 'Share with the community…', icon: 'grid', action: () => this.share(mask) },
      'separator',
      { label: 'Remove from this browser', icon: 'trash', action: () => this.removeLocal(mask) },
      ...(online ? [{ label: `Delete the copy on ${host}`, icon: 'trash', action: () => this.removeRemote(mask) }] : []),
    ];
  }

  async addFiles(files) {
    const images = files.filter((file) => file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name));

    if (!images.length) {
      this.notice.set('Pick image files (PNG, JPEG, WebP, …).', 'warning');
      return;
    }

    const cloud = preference(CLOUD_COPY_KEY);
    let added = 0;
    let last = null;

    this.notice.set(`Adding ${images.length} mask${images.length === 1 ? '' : 's'}…`, 'info');

    for (const file of images) {
      try {
        const name = maskNameFromFile(file);
        const { blob, width, height } = await prepareMaskImage(file);
        const mask = await this.app.customMasks.add({ blob, name, width, height });

        last = mask;
        added += 1;

        if (cloud) {
          await this.uploadPrivately(mask, { quiet: true });
        }
      } catch (error) {
        this.notice.set(`${file.name}: ${error.message}`, 'error');
      }
    }

    await this.refresh();

    if (added) {
      this.notice.set(
        `${added} mask${added === 1 ? '' : 's'} saved${cloud ? `, with a private copy on ${this.server.host}` : ' in this browser'}.`,
        'success'
      );
    }

    // A single new mask is also put on the picture straight away.
    if (images.length === 1 && last && this.app.store.hasImage) {
      await this.app.addBlobMask(last.blob, last.name, { stack: false });
    }

    return last;
  }

  /** "Share a mask…": keeps the image with your masks, then asks to submit it. */
  async shareFile(file) {
    const mask = await this.addFiles([file]);

    if (mask) {
      await this.share((await this.app.customMasks.get(mask.id)) ?? mask);
    }
  }

  async uploadPrivately(mask, { quiet = false } = {}) {
    try {
      const remote = await this.server.upload(mask.blob, mask.name);

      await this.app.customMasks.update(mask.id, { remoteId: remote.id, remoteStatus: remote.status });
      this.lastSync = Date.now();

      if (!quiet) {
        this.notice.set(`“${mask.name}” has a private copy on ${this.server.host}. Your mask key (Settings → Masks) shows it on other devices.`, 'success');
        await this.refresh();
      }

      return remote;
    } catch (error) {
      this.notice.set(error.message, 'error');

      if (quiet) {
        return null;
      }

      throw error;
    }
  }

  async share(mask) {
    const values = await promptDialog(this.app.root, {
      title: 'Share with the community',
      intro: 'Your mask is sent to a moderator first. Once approved, everyone sees it under Community masks. Only share images you made or may share.',
      fields: [
        { key: 'name', label: 'Mask name', value: mask.name, max: 60, required: true },
        { key: 'author', label: 'Your name (optional, shown with the mask)', value: localStorage.getItem('imagemasker.maskAuthor') ?? '', max: 30 },
      ],
      confirm: 'Submit for review',
    });

    if (!values) {
      return;
    }

    try {
      localStorage.setItem('imagemasker.maskAuthor', values.author);
    } catch {
      // Not remembered.
    }

    try {
      const remoteId = mask.remoteId ?? (await this.uploadPrivately(mask, { quiet: true }))?.id;

      if (!remoteId) {
        return;
      }

      const remote = await this.server.submit(remoteId, values);

      await this.app.customMasks.update(mask.id, { name: values.name, remoteId, remoteStatus: remote.status });
      await this.refresh();
      this.notice.set(`“${values.name}” was sent for review. It shows up under Community masks once a moderator approves it.`, 'success');
    } catch (error) {
      this.notice.set(error.message, 'error');
    }
  }

  async rename(mask) {
    const values = await promptDialog(this.app.root, {
      title: 'Rename mask',
      fields: [{ key: 'name', label: 'Name', value: mask.name, max: 60, required: true }],
      confirm: 'Rename',
    });

    if (!values) {
      return;
    }

    try {
      if (mask.remoteId && mask.remoteStatus !== 'approved') {
        await this.server.rename(mask.remoteId, values.name);
      }

      await this.app.customMasks.update(mask.id, { name: values.name });
      await this.refresh();
    } catch (error) {
      this.notice.set(error.message, 'error');
    }
  }

  download(mask) {
    const extension = { 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mask.blob.type] ?? 'png';
    const link = el('a', { href: this.objectUrl(mask), download: `${mask.name}.${extension}` });

    document.body.append(link);
    link.click();
    link.remove();
  }

  async removeLocal(mask) {
    await this.app.customMasks.remove(mask.id);
    await this.refresh();
    this.notice.set(
      mask.remoteId ? `“${mask.name}” was removed from this browser. Its copy on ${this.server.host} is still there.` : `“${mask.name}” was removed.`,
      'info'
    );
  }

  async removeRemote(mask) {
    try {
      await this.server.remove(mask.remoteId);
      await this.app.customMasks.update(mask.id, { remoteId: null, remoteStatus: null });
      await this.refresh();
      this.notice.set(`The copy on ${this.server.host} was deleted${mask.remoteStatus === 'approved' ? ', and it left the community list' : ''}. It is still in this browser.`, 'info');

      if (mask.remoteStatus === 'approved') {
        void this.loadCommunity(true);
      }
    } catch (error) {
      if (error.status === 404) {
        await this.app.customMasks.update(mask.id, { remoteId: null, remoteStatus: null });
        await this.refresh();
      }

      this.notice.set(error.message, 'error');
    }
  }

  saveUrl() {
    const url = this.urlInput.value.trim();

    if (!/^https?:\/\/\S+$/i.test(url)) {
      this.notice.set('Enter a full image URL starting with https://.', 'warning');
      this.urlInput.focus();
      return;
    }

    this.app.maskStorage.addMask(url);
    this.urlInput.value = '';
    this.renderMine();
    this.notice.set('Mask link saved.', 'success');
  }

  /** Updates review statuses and finds masks this key has on the server but this browser lacks. */
  async syncRemote() {
    if (!this.server.hasKey()) {
      return;
    }

    this.lastSync = Date.now();

    try {
      const remote = await this.server.list();
      const byId = new Map(remote.map((entry) => [entry.id, entry]));

      for (const mask of this.masks) {
        if (!mask.remoteId) {
          continue;
        }

        const entry = byId.get(mask.remoteId);
        const status = entry?.status ?? null;

        if (status !== mask.remoteStatus) {
          await this.app.customMasks.update(mask.id, entry ? { remoteStatus: status } : { remoteId: null, remoteStatus: null });
        }
      }

      const local = new Set(this.masks.map((mask) => mask.remoteId).filter(Boolean));

      this.missingRemote = remote.filter((entry) => !local.has(entry.id));
      await this.refresh();
    } catch {
      // Offline or the server is down: statuses update next time.
    }
  }

  async downloadMissing() {
    const missing = [...this.missingRemote];

    this.syncButton.disabled = true;

    try {
      for (const entry of missing) {
        const blob = await this.server.file(entry.id);

        await this.app.customMasks.add({ blob, name: entry.name, width: entry.width, height: entry.height, remoteId: entry.id, remoteStatus: entry.status });
      }

      this.missingRemote = [];
      await this.refresh();
      this.notice.set(`${missing.length} mask${missing.length === 1 ? '' : 's'} added from ${this.server.host}.`, 'success');
    } catch (error) {
      this.notice.set(error.message, 'error');
    } finally {
      this.syncButton.disabled = false;
    }
  }

  // ── community ─────────────────────────────────────────────────────────────

  async loadCommunity(force = false) {
    if (this.communityBusy || (this.community && !force)) {
      return;
    }

    this.communityBusy = true;
    this.communityStatus.classList.remove('hidden');
    this.communityStatus.textContent = 'Loading community masks…';

    try {
      this.community = await this.server.community();
      this.renderCommunity();
    } catch (error) {
      this.communityStatus.textContent = `Community masks could not be loaded. ${error.message}`;
    } finally {
      this.communityBusy = false;
    }
  }

  renderCommunity() {
    const query = this.communitySearch.value.trim().toLowerCase();
    const all = this.community ?? [];
    const starred = starredIds();
    // Starred first; otherwise the server's order (newest first).
    const masks = all
      .filter((mask) => `${mask.name} ${mask.author}`.toLowerCase().includes(query))
      .map((mask, index) => ({ mask, index, starred: starred.has(mask.id) }))
      .sort((a, b) => Number(b.starred) - Number(a.starred) || a.index - b.index);

    this.communitySearch.classList.toggle('hidden', all.length < 9);
    this.communityStatus.classList.toggle('hidden', masks.length > 0);
    this.communityStatus.textContent = all.length ? 'No community masks match.' : 'No community masks yet. Be the first to share one!';
    this.communityGrid.replaceChildren(
      ...masks.map(({ mask, starred: on }) =>
        this.library.tile({
          label: mask.name,
          title: `${mask.name}${mask.author ? ` · by ${mask.author}` : ''} · ${mask.width} × ${mask.height}`,
          image: mask.publicUrl,
          star: { on, toggle: () => this.toggleStar(mask.id) },
          onPick: (options) => this.app.addCommunityMask(mask, options),
          menu: () => [
            { label: 'Add as a new layer', icon: 'plus', action: () => this.app.addCommunityMask(mask, { stack: true }) },
            { label: 'Add as a repeated pattern (like a flag)', icon: 'grid', action: () => this.app.addCommunityMask(mask, { stack: true, repeat: true }) },
            { label: on ? 'Unstar' : 'Star (keep at the top)', icon: 'bookmark', action: () => this.toggleStar(mask.id) },
            { label: 'Save to your masks', icon: 'download', action: () => this.saveCommunity(mask) },
          ],
        })
      )
    );
  }

  /** Stars are kept in this browser only. */
  toggleStar(id) {
    const ids = starredIds();

    if (ids.has(id)) {
      ids.delete(id);
    } else {
      ids.add(id);
    }

    try {
      localStorage.setItem(STARRED_KEY, JSON.stringify([...ids]));
    } catch {
      // Not remembered after this visit.
    }

    this.renderCommunity();
  }

  async saveCommunity(mask) {
    try {
      const response = await fetch(mask.publicUrl, { mode: 'cors' });

      if (!response.ok) {
        throw new Error(`error ${response.status}`);
      }

      await this.app.customMasks.add({ blob: await response.blob(), name: mask.name, width: mask.width, height: mask.height });
      await this.refresh();
      this.notice.set(`“${mask.name}” was added to your masks.`, 'success');
    } catch (error) {
      this.notice.set(`That mask could not be saved. ${error.message}`, 'error');
    }
  }
}
