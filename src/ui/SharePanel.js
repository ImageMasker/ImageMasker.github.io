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

export class SharePanel {
  constructor(app) {
    this.app = app;
    this.roundIndex = 0;
    this.options = { preset: 'original_png', ...EXPORT_PRESETS.original_png };
    this.refs = {};
    this.rounds = new SavedRoundsPanel();
    this.element = el('div', { className: 'share-panel' }, [
      this.renderExport(),
      this.renderShare(),
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
    refs.copyImage = button('Copy to clipboard', { id: 'Copy', iconName: 'clipboard', onClick: () => this.app.copyImage() });
    refs.download = button('Download image', { id: 'Download', iconName: 'download', onClick: () => this.app.downloadImage() });

    return el('fieldset', { className: 'panel-fieldset' }, [
      el('legend', { textContent: 'Export' }),
      refs.preset.element,
      refs.size.element,
      refs.format.element,
      refs.quality.element,
      refs.sizeInfo,
      row([refs.copyImage, refs.download], 'button-row--fill'),
    ]);
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

    refs.upload = button('Upload to Imgur', { id: 'uploadbutton', iconName: 'upload', className: 'app-button--primary', onClick: () => this.upload() });
    refs.url = el('input', { id: 'uploadedUrl', type: 'text', 'aria-label': 'Uploaded image URL', placeholder: 'Uploaded image URL' });
    refs.copyUrl = button('Copy', { id: 'copyToClipboard', onClick: () => this.requireUrl('There is no uploaded URL to copy yet.') && app.copyText(refs.url.value, 'Image URL copied.') });
    refs.checkRis = button('Check RIS', { id: 'checkForRIS', onClick: () => this.requireUrl('Upload an image first to check RIS.') && app.risChecker.check(refs.url.value.trim()) });
    refs.title = el('input', { id: 'roundTitle', type: 'text', placeholder: 'Round Title', maxlength: '285', 'aria-label': 'Round title' });
    refs.answer = el('input', { id: 'roundAnswer', type: 'text', placeholder: 'Round Answer', 'aria-label': 'Round answer' });
    refs.post = button('Submit to /r/PictureGame', { id: 'PostReddit', onClick: () => this.postToReddit() });
    refs.subreddit = el('input', { id: 'newSubInput', type: 'text', value: 'picturegame', placeholder: 'Subreddit', className: 'hidden', 'aria-label': 'Subreddit' });
    refs.subreddit.addEventListener('input', () => this.updatePostLabel());
    refs.save = button('Save round', { id: 'Save', onClick: () => this.saveRound() });
    refs.yml = button('Copy YML', { id: 'Export', onClick: () => app.copyYml({ roundTitle: refs.title.value, roundAnswer: refs.answer.value, imageUrl: refs.url.value }) });
    refs.uploaded = el('div', { className: 'stack share-uploaded' }, [
      el('div', { className: 'input-row' }, [refs.url, refs.copyUrl, refs.checkRis]),
      refs.title,
      refs.answer,
      refs.subreddit,
      row([refs.post, refs.save, refs.yml], 'button-row--fill'),
    ]);
    refs.shareMessage = message();

    refs.token = el('input', { id: 'accessTokenInput', type: 'text', placeholder: 'Imgur access token', 'aria-label': 'Imgur access token', autocomplete: 'off' });
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

    return el('fieldset', { className: 'panel-fieldset' }, [
      el('legend', { textContent: 'Share' }),
      refs.upload,
      refs.shareMessage.element,
      refs.uploaded,
      section('Check any URL for RIS', [el('div', { className: 'input-row' }, [refs.ris, button('Check', { onClick: checkRisUrl })])], { open: false }),
      section('Imgur access token', [
        el('p', { className: 'panel-intro-copy', textContent: 'Optional. With your own token uploads keep their quality and get a higher size limit.' }),
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
      ], { open: false }),
    ]);
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
    this.refs.upload.querySelector('span:last-child').textContent = url ? 'Reupload' : 'Upload to Imgur';
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
      const result = await app.imgurUploader.upload(blob);

      this.setUploaded(result.url);
      app.notify('Upload completed.', 'success');
      app.queueAutosave();
    } catch (error) {
      this.setUploaded(refs.url.value);
      refs.shareMessage.set(`Error uploading to Imgur. Reason: ${error.message}`, 'error');
      app.notify('Error uploading to Imgur.', 'error', 3600);
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
    this.refs.uploaded.classList.remove('hidden');
    this.refs.subreddit.focus();
  }

  saveRound() {
    if (!this.requireUrl('Upload an image first to save the round.')) {
      return;
    }

    this.app.roundStorage.addRound(this.refs.url.value, this.refs.title.value, this.refs.answer.value);
    this.app.flashButton(this.refs.save, 'Saved!');
    this.app.notify('Round saved.', 'success');
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

    return el('fieldset', { className: 'panel-fieldset' }, [
      el('legend', { textContent: 'Add image' }),
      el('div', { className: 'input-row' }, [refs.pasteUrl, button('Load', { onClick: () => app.loadFromUrlInput(refs.pasteUrl) })]),
      row([
        button('Open image…', { iconName: 'image', onClick: () => app.pickFile('base') }),
        button('Add as layer…', { iconName: 'plus', onClick: () => app.pickFile('layer') }),
      ], 'button-row--fill'),
      row([refs.pasteAsLayer.element]),
      el('p', { className: 'panel-intro-copy', textContent: 'When on, pasted images and URLs become layers. Turn off to replace the base image instead.' }),
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
        this.renderRound();
      }
    });
    refs.left.addEventListener('click', () => this.stepRound(-1));
    refs.right.addEventListener('click', () => this.stepRound(1));
    refs.UpdateInfo.addEventListener('click', () => {
      app.roundStorage.updateRound(this.roundIndex, refs.displayedTitle.value, refs.displayedAnswer.value);
      app.flashButton(refs.UpdateInfo, 'Updated!');
    });
    refs.delete.addEventListener('click', () => {
      refs.confirmDelete.classList.remove('hidden');
      refs.confirmDeleteButton.focus();
    });
    refs.cancelDeleteButton.addEventListener('click', () => refs.confirmDelete.classList.add('hidden'));
    refs.confirmDeleteButton.addEventListener('click', () => {
      app.roundStorage.deleteRound(this.roundIndex);
      this.roundIndex = 0;
      this.renderRound();
    });
    refs.export.addEventListener('click', () =>
      app.copyYml({ roundTitle: refs.displayedTitle.value, roundAnswer: refs.displayedAnswer.value, imageUrl: refs.displayedImagelink.href })
    );
    refs.PostReddit2.addEventListener('click', async () => {
      try {
        await app.redditPoster.postToReddit(refs.displayedImage.src, refs.displayedTitle.value, 'picturegame');
        app.notify('Opened Reddit submission page.', 'success');
      } catch {
        app.notify('Could not open Reddit submission flow.', 'error');
      }
    });

    for (const input of [refs.saveFromURLURL, refs.saveFromURLTitle, refs.saveFromURLAnswer]) {
      input.addEventListener('input', () => this.rounds.setMessage(''));
    }
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
    this.renderRound();
  }

  stepRound(delta) {
    this.roundIndex += delta;
    this.renderRound();
  }

  renderRound() {
    const refs = this.rounds.refs;
    const rounds = this.app.roundStorage.getRounds();

    refs.confirmDelete.classList.add('hidden');

    if (!rounds.length) {
      refs.savedRounds.classList.add('hidden');
      refs.emptyState.classList.remove('hidden');
      this.rounds.setSavedRoundsExpanded(false);
      return;
    }

    this.roundIndex = Math.max(0, Math.min(this.roundIndex, rounds.length - 1));

    const [url, title, answer] = rounds[this.roundIndex];

    refs.emptyState.classList.add('hidden');
    refs.savedRounds.classList.remove('hidden');
    refs.displayedImagelink.href = url;
    refs.displayedImage.src = url;
    refs.displayedTitle.value = title ?? '';
    refs.displayedAnswer.value = answer ?? '';
    refs.left.style.visibility = this.roundIndex <= 0 ? 'hidden' : 'visible';
    refs.right.style.visibility = this.roundIndex >= rounds.length - 1 ? 'hidden' : 'visible';
    this.rounds.setSavedRoundsExpanded(true);
  }

  sync() {
    const enabled = this.app.store.hasImage;

    for (const control of [this.refs.copyImage, this.refs.download, this.refs.upload]) {
      control.disabled = !enabled;
    }

    this.updateSizeInfo();
  }
}
