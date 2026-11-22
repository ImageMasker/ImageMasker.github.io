// Output side of the workflow: export settings, clipboard/download, Imgur upload, RIS check,
// Reddit submission, shortcuts to the Rounds dialog and loading images by URL.

import { el } from '../utils/dom.js';
import { button, message, row, section, select, slider, toggle } from './kit.js';

export const EXPORT_PRESETS = {
  original_png: { label: 'Original PNG', format: 'png', size: 'original', quality: 92 },
  editor_png: { label: 'Editor PNG', format: 'png', size: 'editor', quality: 92 },
  web_jpeg: { label: 'Web JPEG', format: 'jpeg', size: 'editor', quality: 85 },
  original_jpeg: { label: 'Original JPEG', format: 'jpeg', size: 'original', quality: 92 },
};

function exportOptions({ preset, format, size, quality } = {}) {
  return {
    preset,
    format: format === 'jpeg' ? 'jpeg' : 'png',
    size: size === 'editor' ? 'editor' : 'original',
    quality: Math.max(40, Math.min(100, Number(quality) || 92)),
  };
}

export class SharePanel {
  constructor(app) {
    this.app = app;
    const stored = app.settings.getExportSettings();
    this.options = EXPORT_PRESETS[stored.preset] ? exportOptions(stored) : { preset: 'original_png', ...EXPORT_PRESETS.original_png };
    this.refs = {};
    const share = this.renderShare();

    share.append(this.renderExport());
    this.element = el('div', { className: 'share-panel' }, [
      share,
      this.renderImport(),
      this.renderRounds(),
    ]);

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
        this.saveExportOptions();
      },
    });
    refs.preset.input.id = 'exportPreset';
    refs.size = select({
      label: 'Size',
      options: [{ value: 'original', label: 'Original size' }, { value: 'editor', label: 'Editor size' }],
      value: this.options.size,
      onChange: (value) => {
        this.options.size = value;
        this.saveExportOptions();
      },
    });
    refs.format = select({
      label: 'Format',
      options: [{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }],
      value: this.options.format,
      onChange: (value) => {
        this.options.format = value;
        this.saveExportOptions();
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
      onChange: () => this.saveExportOptions(),
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

  saveExportOptions() {
    this.app.settings.setExportSettings(this.options);
    this.updateSizeInfo();
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
    // Phones (and some desktops) can hand the picture straight to another app, e.g. the Reddit app.
    refs.share = button('Share image…', {
      id: 'shareImage',
      iconName: 'share',
      title: 'Opens the share sheet with the picture, e.g. to post it from the Reddit app. The [Round N] title is copied too.',
      onClick: () => this.shareImage(),
    });
    refs.share.classList.toggle('hidden', !app.canShareFiles());

    if (app.canShareFiles() && window.matchMedia?.('(pointer: coarse)')?.matches) {
      refs.share.classList.add('app-button--primary');
      refs.copyPost.classList.remove('app-button--primary');
    }

    refs.upload = button('Upload', { id: 'uploadbutton', iconName: 'upload', className: 'app-button--fill', onClick: () => this.upload() });
    refs.url = el('input', { id: 'uploadedUrl', type: 'text', 'aria-label': 'Uploaded image URL', placeholder: 'Uploaded image URL' });
    refs.copyUrl = button('Copy', { id: 'copyToClipboard', onClick: () => this.requireUrl('There is no uploaded URL to copy yet.') && app.copyText(refs.url.value, 'Image URL copied.') });
    refs.checkRis = button('Check RIS', { id: 'checkForRIS', onClick: () => this.requireUrl('Upload an image first to check RIS.') && app.risChecker.check(refs.url.value.trim()) });
    refs.post = button('Submit to /r/PictureGame', { id: 'PostReddit', onClick: () => this.postToReddit() });
    refs.save = button('Save round…', { id: 'Save', iconName: 'bookmark', title: 'Save the round with its title and answer (in this browser, or uploaded)', onClick: () => this.saveRound() });
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
      ...(refs.share.classList.contains('app-button--primary') ? [refs.share, refs.copyPost] : [refs.copyPost, refs.share]),
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

  async shareImage() {
    const label = this.refs.share.querySelector('span:last-child');

    label.textContent = 'Preparing…';

    try {
      const result = await this.app.shareImage(this.refs.title.value);

      label.textContent = result === 'retry' ? 'Share now' : 'Share image…';
    } catch {
      label.textContent = 'Share image…';
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
      this.options = exportOptions({ preset: state.exportPreset, format: state.exportFormat, size: state.exportSize, quality: state.exportQuality });
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
      const doc = app.store.doc;
      const options = this.getExportOptions();
      const blob = await app.exportBlob(options);
      const url = await app.imageHosts.upload(blob);

      app.noteUpload(doc, options, url);
      this.setUploaded(url);
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

  saveRound() {
    this.app.roundsDialog.open('save');
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
    return el('fieldset', { className: 'panel-fieldset' }, [
      el('legend', { textContent: 'Saved rounds' }),
      el('p', { className: 'panel-intro-copy', textContent: 'Also under Rounds at the top.' }),
      row([
        button('Save round…', { iconName: 'bookmark', onClick: () => this.app.roundsDialog.open('save') }),
        button('Browse rounds…', { iconName: 'grid', onClick: () => this.app.roundsDialog.open('browse') }),
      ], 'button-row--fill'),
    ]);
  }

  sync() {
    const enabled = this.app.store.hasImage;

    for (const control of [this.refs.upload, this.refs.copyPost, this.refs.share, this.refs.save]) {
      control.disabled = !enabled;
    }

    this.updateSizeInfo();
  }
}
