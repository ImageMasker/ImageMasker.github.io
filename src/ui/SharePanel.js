// Output side of the workflow: export settings, clipboard/download, Imgur upload, RIS check,
// Reddit submission, saved rounds and loading images by URL.

import { el } from '../utils/dom.js';
import { button, message, row, section, select, slider, toggle } from './kit.js';
import { SavedRoundsPanel } from './SavedRoundsPanel.js';

export const EXPORT_PRESETS = {
  original_png: { label: 'Original PNG', format: 'png', size: 'original', quality: 92 },
  editor_png: { label: 'Editor PNG', format: 'png', size: 'editor', quality: 92 },
  web_jpeg: { label: 'Web JPEG', format: 'jpeg', size: 'editor', quality: 85 },
  original_jpeg: { label: 'Original JPEG', format: 'jpeg', size: 'original', quality: 92 },
};

function formatSize(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export class SharePanel {
  constructor(app) {
    this.app = app;
    this.roundIndex = 0;
    this.options = { preset: 'original_png', ...EXPORT_PRESETS.original_png };
    this.refs = {};
    this.rounds = new SavedRoundsPanel();
    const share = this.renderShare();

    share.append(this.renderExport());
    this.element = el('div', { className: 'share-panel' }, [
      share,
      this.renderImport(),
      this.renderRounds(),
    ]);

    this.bindRounds();
    this.setUploaded('');
    app.store.on('doc', () => this.updateSizeInfo());
    app.bus.on('view', () => this.updateSizeInfo());
    app.bus.on('image-changed', () => this.sync());
    this.sync();
  }

  // ── export ────────────────────────────────────────────────────────────────

  renderExport() {
    const refs = this.refs;

    refs.preset = select({
      label: 'Preset',
      options: Object.entries(EXPORT_PRESETS).map(([value, preset]) => ({ value, label: preset.label })),
      value: this.options.preset,
      onChange: (value) => {
        Object.assign(this.options, { preset: value }, EXPORT_PRESETS[value]);
        refs.size.set(this.options.size);
        refs.format.set(this.options.format);
        refs.quality.set(this.options.quality);
        this.updateSizeInfo();
      },
    });
    refs.preset.input.id = 'exportPreset';
    refs.size = select({
      label: 'Size',
      options: [{ value: 'original', label: 'Original size' }, { value: 'editor', label: 'Editor size' }],
      value: this.options.size,
      onChange: (value) => {
        this.options.size = value;
        this.updateSizeInfo();
      },
    });
    refs.format = select({
      label: 'Format',
      options: [{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }],
      value: this.options.format,
      onChange: (value) => {
        this.options.format = value;
        this.updateSizeInfo();
      },
    });
    refs.quality = slider({
      label: 'JPEG quality',
      min: 40,
      max: 100,
      value: this.options.quality,
      format: (value) => `${Math.round(value)}%`,
      onInput: (value) => {
        this.options.quality = value;
      },
    });
    refs.sizeInfo = el('div', { className: 'export-size-info' });

    return section('Export settings', [
      refs.preset.element,
      refs.size.element,
      refs.format.element,
      refs.quality.element,
      refs.sizeInfo,
      el('p', { className: 'panel-intro-copy', textContent: 'Used by Copy and Download in the header, and by uploads.' }),
    ], { open: false, className: 'share-section' });
  }

  getExportOptions() {
    return { format: this.options.format, size: this.options.size, quality: this.options.quality / 100 };
  }

  updateSizeInfo() {
    const { store } = this.app;

    this.refs.quality.element.classList.toggle('hidden', this.options.format !== 'jpeg');

    if (!store.hasImage) {
      this.refs.sizeInfo.textContent = '';
      return;
    }

    const scale = this.app.exportScale(this.options.size);

    this.refs.sizeInfo.textContent =
      `Output: ${Math.round(store.doc.width * scale)} × ${Math.round(store.doc.height * scale)} px`;
  }

  // ── share ─────────────────────────────────────────────────────────────────

  renderShare() {
    const refs = this.refs;
    const app = this.app;
    const hosts = app.imageHosts;

    refs.title = el('input', { id: 'roundTitle', type: 'text', placeholder: 'Round Title', maxlength: '285', 'aria-label': 'Round title' });
    refs.answer = el('input', { id: 'roundAnswer', type: 'text', placeholder: 'Round Answer', 'aria-label': 'Round answer' });
    refs.subreddit = el('input', { id: 'newSubInput', type: 'text', value: 'picturegame', placeholder: 'Subreddit', className: 'hidden', 'aria-label': 'Subreddit' });
    refs.subreddit.addEventListener('input', () => this.updatePostLabel());
    refs.copyPost = button('Copy image & post to Reddit', {
      id: 'copyAndPost',
      iconName: 'reddit',
      className: 'app-button--primary',
      title: 'Copies the picture and opens the Reddit image post with the next round number in the title. Paste (Ctrl+V) there and submit.',
      onClick: () => this.copyAndPost(),
    });
    refs.upload = button('Upload', { id: 'uploadbutton', iconName: 'upload', className: 'app-button--fill', onClick: () => this.upload() });
    refs.url = el('input', { id: 'uploadedUrl', type: 'text', 'aria-label': 'Uploaded image URL', placeholder: 'Uploaded image URL' });
    refs.copyUrl = button('Copy', { id: 'copyToClipboard', onClick: () => this.requireUrl('There is no uploaded URL to copy yet.') && app.copyText(refs.url.value, 'Image URL copied.') });
    refs.checkRis = button('Check RIS', { id: 'checkForRIS', onClick: () => this.requireUrl('Upload an image first to check RIS.') && app.risChecker.check(refs.url.value.trim()) });
    refs.post = button('Submit to /r/PictureGame', { id: 'PostReddit', onClick: () => this.postToReddit() });
    refs.save = button('Save round', { id: 'Save', iconName: 'download', title: 'Keeps the round in this browser. Without an upload the finished picture is stored here (no layers or history).', onClick: () => this.saveRound() });
    refs.yml = button('Copy YML', { id: 'Export', onClick: () => app.copyYml({ roundTitle: refs.title.value, roundAnswer: refs.answer.value, imageUrl: refs.url.value }) });
    refs.uploaded = el('div', { className: 'stack share-uploaded' }, [
      el('div', { className: 'input-row' }, [refs.url, refs.copyUrl, refs.checkRis]),
      row([refs.post, refs.yml], 'button-row--fill'),
    ]);
    refs.shareMessage = message();

    refs.host = select({
      label: 'Upload to',
      options: hosts.hosts.map((host) => ({ value: host.id, label: host.label })),
      value: hosts.getHostId(),
      onChange: (value) => {
        hosts.setHostId(value);
        this.syncHost();
      },
    });
    refs.hostNote = el('p', { className: 'panel-intro-copy' });
    refs.imgbbKey = el('input', { type: 'text', placeholder: 'ImgBB API key', 'aria-label': 'ImgBB API key', autocomplete: 'off' });
    refs.imgbbKey.value = hosts.getImgbbKey();
    refs.imgbbKey.addEventListener('change', () => {
      hosts.setImgbbKey(refs.imgbbKey.value.trim());
      app.notify(refs.imgbbKey.value.trim() ? 'ImgBB key saved.' : 'ImgBB key removed.', 'success');
    });
    refs.imgbbBlock = el('div', { className: 'stack' }, [
      refs.imgbbKey,
      el('a', { className: 'panel-intro-copy', href: 'https://api.imgbb.com/', target: '_blank', rel: 'noopener', textContent: 'Get a free key at api.imgbb.com' }),
    ]);
    refs.token = el('input', { id: 'accessTokenInput', type: 'text', placeholder: 'Imgur access token', 'aria-label': 'Imgur access token', autocomplete: 'off' });
    refs.imgurBlock = el('div', { className: 'stack' }, [
      el('p', { className: 'panel-intro-copy', textContent: 'Optional Imgur token: uploads keep their quality and get a higher size limit.' }),
      refs.token,
      row([
        button('Save token', {
          id: 'accessTokenSubmit',
          onClick: () => {
            app.settings.setAccessToken(refs.token.value.trim());
            refs.token.value = '';
            refs.token.placeholder = 'Access token saved';
            app.notify('Imgur access token saved.', 'success');
          },
        }),
        button('Delete token', {
          id: 'accessTokenDelete',
          onClick: () => {
            app.settings.deleteAccessToken();
            refs.token.value = '';
            refs.token.placeholder = 'Access token deleted';
            app.notify('Imgur access token deleted.', 'success');
          },
        }),
      ]),
    ]);
    refs.ris = el('input', { id: 'mobileRISURL', type: 'url', placeholder: 'Paste an URL here to check for RIS', 'aria-label': 'Paste URL to check for RIS' });

    const checkRisUrl = () => {
      const url = refs.ris.value.trim();

      if (!url) {
        app.notify('Paste an image URL to check RIS.', 'warning');
        return;
      }

      app.risChecker.check(url);
    };

    refs.ris.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        checkRisUrl();
      }
    });

    if (app.settings.getAccessToken()) {
      refs.token.placeholder = 'Access token saved';
    }

    const fieldset = el('fieldset', { className: 'panel-fieldset' }, [
      el('legend', { textContent: 'Share' }),
      refs.title,
      refs.answer,
      refs.subreddit,
      refs.copyPost,
      row([refs.save], 'button-row--fill'),
      refs.shareMessage.element,
      section('Upload to an image host', [refs.host.element, refs.hostNote, refs.imgbbBlock, refs.imgurBlock, refs.upload, refs.uploaded], { open: false }),
      section('Check any URL for RIS', [el('div', { className: 'input-row' }, [refs.ris, button('Check', { onClick: checkRisUrl })])], { open: false }),
    ]);

    this.syncHost();
    return fieldset;
  }

  syncHost() {
    const refs = this.refs;
    const host = this.app.imageHosts.getHost();

    refs.hostNote.textContent = host.note;
    refs.imgbbBlock.classList.toggle('hidden', host.id !== 'imgbb');
    refs.imgurBlock.classList.toggle('hidden', host.id !== 'imgur');
    this.setUploaded(refs.url.value);
  }

  async copyAndPost() {
    const result = await this.app.copyAndPost(this.refs.title.value, this.refs.subreddit.value.trim() || 'picturegame');

    if (result && !result.opened) {
      const link = el('a', { href: result.url, target: '_blank', rel: 'noopener', textContent: 'Open the Reddit post form' });

      this.refs.shareMessage.set('The picture is on your clipboard. ', 'warning');
      this.refs.shareMessage.element.append(link);
    }
  }

  requireUrl(warning) {
    if (this.refs.url.value.trim()) {
      return true;
    }

    this.app.notify(warning, 'warning');
    return false;
  }

  setUploaded(url) {
    this.refs.url.value = url;
    this.refs.uploaded.classList.toggle('hidden', !url);
    this.refs.upload.querySelector('span:last-child').textContent = `${url ? 'Reupload' : 'Upload'} to ${this.app.imageHosts.getHost().label}`;
  }

  getShareState() {
    const refs = this.refs;

    return {
      uploadedUrl: refs.url.value,
      roundTitle: refs.title.value,
      roundAnswer: refs.answer.value,
      subreddit: refs.subreddit.value || 'picturegame',
      exportPreset: this.options.preset,
      exportSize: this.options.size,
      exportFormat: this.options.format,
      exportQuality: this.options.quality,
    };
  }

  setShareState(state = {}) {
    const refs = this.refs;

    refs.title.value = state.roundTitle ?? '';
    refs.answer.value = state.roundAnswer ?? '';
    refs.subreddit.value = state.subreddit || 'picturegame';
    this.setUploaded(state.uploadedUrl ?? '');
    this.updatePostLabel();

    if (EXPORT_PRESETS[state.exportPreset]) {
      this.options = {
        preset: state.exportPreset,
        format: state.exportFormat === 'jpeg' ? 'jpeg' : 'png',
        size: state.exportSize === 'editor' ? 'editor' : 'original',
        quality: Math.max(40, Math.min(100, Number(state.exportQuality) || 92)),
      };
      refs.preset.set(this.options.preset);
      refs.size.set(this.options.size);
      refs.format.set(this.options.format);
      refs.quality.set(this.options.quality);
    }

    this.updateSizeInfo();
  }

  async upload() {
    const refs = this.refs;
    const app = this.app;

    if (!app.requireImage('Load an image before uploading.')) {
      return;
    }

    const label = refs.upload.querySelector('span:last-child');

    label.textContent = 'Uploading...';
    refs.upload.disabled = true;
    refs.shareMessage.set('');

    try {
      const blob = await app.exportBlob(this.getExportOptions());
      this.setUploaded(await app.imageHosts.upload(blob));
      app.notify('Upload completed.', 'success');
      app.queueAutosave();
    } catch (error) {
      this.setUploaded(refs.url.value);
      refs.shareMessage.set(`The upload failed. Reason: ${error.message} You can switch host above, or use "Copy image & post to Reddit".`, 'error');
      app.notify('The upload failed.', 'error', 3600);
    } finally {
      refs.upload.disabled = false;
    }
  }

  async postToReddit() {
    if (!this.requireUrl('Upload an image first before posting to Reddit.')) {
      return;
    }

    try {
      await this.app.redditPoster.postToReddit(this.refs.url.value, this.refs.title.value, this.refs.subreddit.value || 'picturegame');
      this.app.notify('Opened Reddit submission page.', 'success');
    } catch {
      this.app.notify('Could not open Reddit submission flow.', 'error');
    }
  }

  updatePostLabel() {
    const subreddit = this.refs.subreddit.value.trim() || 'picturegame';

    this.refs.post.querySelector('span').textContent = `Submit to /r/${subreddit === 'picturegame' ? 'PictureGame' : subreddit}`;
  }

  showSubredditInput() {
    this.refs.subreddit.classList.remove('hidden');
    this.refs.subreddit.focus();
  }

  async saveRound() {
    const app = this.app;
    const refs = this.refs;

    if (!app.requireImage('Load an image before saving a round.')) {
      return;
    }

    if (refs.url.value.trim()) {
      app.roundStorage.addRound(refs.url.value.trim(), refs.title.value, refs.answer.value);
      app.flashButton(refs.save, 'Saved!');
      app.notify('Round saved with its uploaded link.', 'success');
    } else {
      refs.save.disabled = true;

      try {
        const round = await app.saveLocalRound(refs.title.value, refs.answer.value);

        app.flashButton(refs.save, 'Saved!');
        app.notify(`Round saved in this browser (${formatSize(round.blob.size)}). Find it under Saved rounds.`, 'success', 3600);
      } catch (error) {
        console.error(error);
        app.notify(`The round could not be saved. ${error?.message ?? ''}`.trim(), 'error', 4200);
      } finally {
        refs.save.disabled = !app.store.hasImage;
      }
    }

    if (this.roundsOpen) {
      await this.renderRound();
    }
  }

  // ── import ────────────────────────────────────────────────────────────────

  renderImport() {
    const refs = this.refs;
    const app = this.app;

    refs.pasteUrl = el('input', { id: 'pastedURL', type: 'url', placeholder: 'Or paste the image URL here...', 'aria-label': 'Paste image URL' });
    refs.pasteUrl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        app.loadFromUrlInput(refs.pasteUrl);
      }
    });
    refs.pasteAsLayer = toggle({
      label: 'Paste as new layer',
      value: app.settings.getPasteImageAsLayer(),
      onChange: (value) => app.settings.setPasteImageAsLayer(value),
    });
    refs.pasteAsLayer.element.id = 'pasteImagesAsLayer';
    refs.pasteAsLayer.element.title = 'When on, pasted images and URLs become layers. Turn off to replace the base picture instead.';

    return el('fieldset', { className: 'panel-fieldset' }, [
      el('legend', { textContent: 'Add image' }),
      el('div', { className: 'input-row' }, [refs.pasteUrl, button('Load', { onClick: () => app.loadFromUrlInput(refs.pasteUrl) })]),
      row([
        button('Open image…', { iconName: 'image', onClick: () => app.pickFile('base') }),
        button('Add as layer…', { iconName: 'plus', onClick: () => app.pickFile('layer') }),
      ], 'button-row--fill'),
      row([refs.pasteAsLayer.element]),
    ]);
  }

  // ── saved rounds ──────────────────────────────────────────────────────────

  renderRounds() {
    return el('fieldset', { className: 'panel-fieldset' }, [el('legend', { textContent: 'Saved rounds' }), this.rounds.element]);
  }

  get roundsOpen() {
    return !this.rounds.refs.savedRounds.classList.contains('hidden');
  }

  bindRounds() {
    const refs = this.rounds.refs;
    const app = this.app;

    refs.info = el('div', { className: 'saved-round-info' });
    refs.uploadRound = button('Upload', { iconName: 'upload', title: 'Upload to the image host chosen above and keep the round with its link', onClick: () => this.uploadCurrentRound() });
    refs.openRound = button('Open in editor', { iconName: 'image', onClick: () => this.currentRound && app.openAsNewDocument(this.currentRound.blob) });
    refs.downloadRound = button('Download', { iconName: 'download', onClick: () => this.downloadCurrentRound() });
    refs.localActions = row([refs.uploadRound, refs.openRound, refs.downloadRound], 'button-row--fill');
    refs.savedRounds.append(refs.info, refs.localActions);
    refs.savedRoundsButton.classList.add('app-button');
    refs.saveFromUrlButton.classList.add('app-button');
    refs.savedRoundsButton.addEventListener('click', () => this.toggleRounds());
    refs.saveFromUrlButton.addEventListener('click', () => {
      const show = refs.saveExternalUrl.classList.contains('hidden');

      refs.saveExternalUrl.classList.toggle('hidden', !show);
      refs.emptyState.classList.add('hidden');
      refs.confirmDelete.classList.add('hidden');
      this.rounds.setMessage('');
      this.rounds.setSaveFromUrlExpanded(show);
    });
    refs.saveExternal.addEventListener('click', () => {
      const url = refs.saveFromURLURL.value.trim();

      if (!url) {
        this.rounds.setMessage('Enter an image URL before saving the round.', 'warning');
        refs.saveFromURLURL.focus();
        return;
      }

      app.roundStorage.addRound(url, refs.saveFromURLTitle.value, refs.saveFromURLAnswer.value);
      app.flashButton(refs.saveExternal, 'Saved!');
      this.rounds.setMessage('Round saved from URL.', 'success');

      if (this.roundsOpen) {
        void this.renderRound();
      }
    });
    refs.left.addEventListener('click', () => this.stepRound(-1));
    refs.right.addEventListener('click', () => this.stepRound(1));
    refs.UpdateInfo.addEventListener('click', async () => {
      const round = this.currentRound;

      if (!round) return;

      if (round.kind === 'local') {
        await app.localRounds.update(round.id, { title: refs.displayedTitle.value, answer: refs.displayedAnswer.value });
      } else {
        app.roundStorage.updateRound(round.index, refs.displayedTitle.value, refs.displayedAnswer.value);
      }

      app.flashButton(refs.UpdateInfo, 'Updated!');
    });
    refs.delete.addEventListener('click', () => {
      refs.confirmDelete.classList.remove('hidden');
      refs.confirmDeleteButton.focus();
    });
    refs.cancelDeleteButton.addEventListener('click', () => refs.confirmDelete.classList.add('hidden'));
    refs.confirmDeleteButton.addEventListener('click', async () => {
      const round = this.currentRound;

      if (round?.kind === 'local') {
        await app.localRounds.remove(round.id);
      } else if (round) {
        app.roundStorage.deleteRound(round.index);
      }

      await this.renderRound();
    });
    refs.export.addEventListener('click', () =>
      app.copyYml({ roundTitle: refs.displayedTitle.value, roundAnswer: refs.displayedAnswer.value, imageUrl: this.currentRound?.url ?? '' })
    );
    refs.PostReddit2.addEventListener('click', async () => {
      const round = this.currentRound;

      if (round?.kind === 'local') {
        await app.copyAndPost(refs.displayedTitle.value, 'picturegame', round.blob);
        return;
      }

      try {
        await app.redditPoster.postToReddit(round?.url ?? '', refs.displayedTitle.value, 'picturegame');
        app.notify('Opened Reddit submission page.', 'success');
      } catch {
        app.notify('Could not open Reddit submission flow.', 'error');
      }
    });

    for (const input of [refs.saveFromURLURL, refs.saveFromURLTitle, refs.saveFromURLAnswer]) {
      input.addEventListener('input', () => this.rounds.setMessage(''));
    }
  }

  /** Uploaded rounds (localStorage, shared with v2) followed by rounds kept in this browser. */
  async collectRounds() {
    const uploaded = this.app.roundStorage.getRounds().map(([url, title, answer], index) => ({ kind: 'url', index, url, title, answer }));
    let local = [];

    try {
      local = (await this.app.localRounds.list()).map((round) => ({ kind: 'local', ...round }));
    } catch (error) {
      console.warn('Local rounds are unavailable', error);
    }

    return [...uploaded, ...local];
  }

  toggleRounds() {
    const refs = this.rounds.refs;

    if (this.roundsOpen) {
      refs.savedRounds.classList.add('hidden');
      refs.confirmDelete.classList.add('hidden');
      this.rounds.setSavedRoundsExpanded(false);
      return;
    }

    this.roundIndex = 0;
    void this.renderRound();
  }

  stepRound(delta) {
    this.roundIndex += delta;
    void this.renderRound();
  }

  async renderRound() {
    const refs = this.rounds.refs;
    const rounds = await this.collectRounds();

    refs.confirmDelete.classList.add('hidden');

    if (this.roundUrl) {
      URL.revokeObjectURL(this.roundUrl);
      this.roundUrl = '';
    }

    if (!rounds.length) {
      this.currentRound = null;
      refs.savedRounds.classList.add('hidden');
      refs.emptyState.classList.remove('hidden');
      this.rounds.setSavedRoundsExpanded(false);
      return;
    }

    this.roundIndex = Math.max(0, Math.min(this.roundIndex, rounds.length - 1));

    const round = rounds[this.roundIndex];
    const local = round.kind === 'local';
    const src = local ? (this.roundUrl = URL.createObjectURL(round.blob)) : round.url;

    this.currentRound = round;
    refs.emptyState.classList.add('hidden');
    refs.savedRounds.classList.remove('hidden');
    refs.displayedImagelink.href = src;
    refs.displayedImage.src = src;
    refs.displayedTitle.value = round.title ?? '';
    refs.displayedAnswer.value = round.answer ?? '';
    refs.left.style.visibility = this.roundIndex <= 0 ? 'hidden' : 'visible';
    refs.right.style.visibility = this.roundIndex >= rounds.length - 1 ? 'hidden' : 'visible';
    refs.info.textContent = `${this.roundIndex + 1} of ${rounds.length} · ${local ? `Saved in this browser · ${round.width} × ${round.height} · ${formatSize(round.blob.size)}` : 'Uploaded'}`;
    refs.localActions.classList.toggle('hidden', !local);
    refs.export.classList.toggle('hidden', local);
    refs.PostReddit2.querySelector('span')?.remove();
    refs.PostReddit2.textContent = local ? 'Copy image & post to /r/PictureGame' : 'Submit to /r/PictureGame';
    this.rounds.setSavedRoundsExpanded(true);
  }

  async uploadCurrentRound() {
    const round = this.currentRound;
    const app = this.app;
    const refs = this.rounds.refs;

    if (round?.kind !== 'local') {
      return;
    }

    refs.uploadRound.disabled = true;

    try {
      const url = await app.imageHosts.upload(round.blob);

      app.roundStorage.addRound(url, refs.displayedTitle.value, refs.displayedAnswer.value);
      await app.localRounds.remove(round.id);
      this.roundIndex = app.roundStorage.getCount() - 1;
      app.notify('Round uploaded. It now keeps its link instead of the local picture.', 'success', 3600);
      await this.renderRound();
    } catch (error) {
      app.notify(`The upload failed. ${error.message}`, 'error', 4200);
    } finally {
      refs.uploadRound.disabled = false;
    }
  }

  downloadCurrentRound() {
    const round = this.currentRound;

    if (round?.kind !== 'local') {
      return;
    }

    const url = URL.createObjectURL(round.blob);
    const name = (round.title || 'round').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'round';
    const link = el('a', { href: url, download: `${name}.jpg` });

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  sync() {
    const enabled = this.app.store.hasImage;

    for (const control of [this.refs.upload, this.refs.copyPost, this.refs.save]) {
      control.disabled = !enabled;
    }

    this.updateSizeInfo();
  }
}
