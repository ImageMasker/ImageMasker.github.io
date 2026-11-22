// Rounds dialog (header → Rounds): save the current picture as a round with its title and
// answer, and browse every saved round. Uploaded rounds live in localStorage ('rounds', shared
// with the previous version); rounds kept without uploading live in IndexedDB (LocalRounds).

import { el } from '../utils/dom.js';
import { button, row } from './kit.js';
import { Modal } from './Modal.js';

function formatSize(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(iso) {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const keyOf = (round) => (round.kind === 'local' ? `local:${round.id}` : `url:${round.url}`);

export class RoundsDialog {
  constructor(app) {
    this.app = app;
    this.rounds = [];
    this.objectUrls = [];
    this.filter = 'all';
    this.query = '';
    this.showAnswers = false;
    this.currentKey = null;
    this.saveMode = 'local';
    this.modal = new Modal({ title: 'Rounds', className: 'rounds-modal', onClose: () => this.releaseUrls() });
    this.element = this.modal.element;
    this.refs = {};
    this.render();
  }

  get isOpen() {
    return this.modal.isOpen;
  }

  /** True while one round is shown large (the arrow keys then step through rounds). */
  get detailOpen() {
    return this.isOpen && this.tab === 'browse' && Boolean(this.currentKey);
  }

  // ── layout ────────────────────────────────────────────────────────────────

  render() {
    const refs = this.refs;

    refs.tabSave = el('button', { type: 'button', className: 'settings-tab-button', textContent: 'Save this round' });
    refs.tabBrowse = el('button', { type: 'button', className: 'settings-tab-button', textContent: 'Saved rounds' });
    refs.tabSave.addEventListener('click', () => this.setTab('save'));
    refs.tabBrowse.addEventListener('click', () => this.setTab('browse'));
    this.modal.headerExtra.append(el('div', { className: 'settings-tab-list' }, [refs.tabSave, refs.tabBrowse]));

    refs.savePanel = this.renderSave();
    refs.browsePanel = el('div', { className: 'rounds-browse' });
    this.modal.body.append(refs.savePanel, refs.browsePanel);
    this.modal.element.addEventListener('keydown', (event) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);

      if (this.detailOpen && !typing && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        this.step(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
  }

  renderSave() {
    const refs = this.refs;
    const app = this.app;

    refs.preview = el('img', { className: 'rounds-save-preview', alt: 'The picture that will be saved' });
    refs.previewEmpty = el('div', { className: 'rounds-save-empty', textContent: 'Load a picture in the editor to save it as a round.' });
    refs.title = el('input', { type: 'text', maxlength: '285', placeholder: 'What is this a picture of? (round title)', 'aria-label': 'Round title' });
    refs.answer = el('input', { type: 'text', placeholder: 'Answer', 'aria-label': 'Round answer' });
    refs.modeLocal = el('input', { type: 'radio', name: 'roundSaveMode', value: 'local' });
    refs.modeUpload = el('input', { type: 'radio', name: 'roundSaveMode', value: 'upload' });
    refs.modeUploadLabel = el('span');
    refs.saveButton = button('Save round', { iconName: 'bookmark', className: 'app-button--primary', onClick: () => this.saveCurrent() });

    for (const input of [refs.modeLocal, refs.modeUpload]) {
      input.addEventListener('change', () => {
        this.saveMode = input.value;
      });
    }

    // Keep the Share tab's title/answer (used when posting) in step with this form.
    refs.title.addEventListener('input', () => (app.sharePanel.refs.title.value = refs.title.value));
    refs.answer.addEventListener('input', () => (app.sharePanel.refs.answer.value = refs.answer.value));
    refs.title.addEventListener('keydown', (event) => event.key === 'Enter' && refs.answer.focus());
    refs.answer.addEventListener('keydown', (event) => event.key === 'Enter' && this.saveCurrent());

    refs.urlUrl = el('input', { type: 'url', placeholder: 'Image URL', 'aria-label': 'Image URL of the round' });
    refs.urlTitle = el('input', { type: 'text', placeholder: 'Title', 'aria-label': 'Title of the round' });
    refs.urlAnswer = el('input', { type: 'text', placeholder: 'Answer', 'aria-label': 'Answer of the round' });

    return el('div', { className: 'rounds-save' }, [
      el('div', { className: 'rounds-save-picture' }, [refs.preview, refs.previewEmpty]),
      el('div', { className: 'stack rounds-save-form' }, [
        el('label', { className: 'field' }, [el('span', { className: 'field-label', textContent: 'Title' }), refs.title]),
        el('label', { className: 'field' }, [el('span', { className: 'field-label', textContent: 'Answer' }), refs.answer]),
        el('div', { className: 'rounds-save-mode', role: 'radiogroup', 'aria-label': 'How to save' }, [
          el('label', {}, [refs.modeLocal, el('span', { textContent: 'Keep in this browser (no upload)' })]),
          el('label', {}, [refs.modeUpload, refs.modeUploadLabel]),
        ]),
        refs.saveButton,
        el('details', { className: 'tool-section rounds-save-url' }, [
          el('summary', { className: 'tool-section-summary', textContent: 'Save a round from an image URL' }),
          el('div', { className: 'tool-section-body stack' }, [
            refs.urlUrl,
            refs.urlTitle,
            refs.urlAnswer,
            button('Save from URL', { onClick: () => this.saveFromUrl() }),
          ]),
        ]),
      ]),
    ]);
  }

  // ── open / tabs ───────────────────────────────────────────────────────────

  open(tab = this.app.store.hasImage ? 'save' : 'browse') {
    this.modal.open();
    this.setTab(tab);
  }

  setTab(tab) {
    this.tab = tab;
    this.refs.tabSave.classList.toggle('is-active', tab === 'save');
    this.refs.tabBrowse.classList.toggle('is-active', tab === 'browse');
    this.refs.savePanel.classList.toggle('hidden', tab !== 'save');
    this.refs.browsePanel.classList.toggle('hidden', tab !== 'browse');

    if (tab === 'save') {
      void this.prepareSave();
    } else {
      void this.refresh();
    }
  }

  async prepareSave() {
    const { refs, app } = this;
    const loaded = app.store.hasImage;

    refs.title.value = app.sharePanel.refs.title.value;
    refs.answer.value = app.sharePanel.refs.answer.value;
    refs.modeUploadLabel.textContent = `Upload to ${app.imageHosts.getHost().label} and keep the link`;
    refs.modeLocal.checked = this.saveMode !== 'upload';
    refs.modeUpload.checked = this.saveMode === 'upload';
    refs.saveButton.disabled = !loaded;
    refs.preview.classList.toggle('hidden', !loaded);
    refs.previewEmpty.classList.toggle('hidden', loaded);

    if (loaded) {
      refs.title.focus();

      try {
        const blob = await app.exportBlob({ format: 'jpeg', quality: 0.85, scale: Math.min(1, 900 / Math.max(app.store.doc.width, app.store.doc.height)) });

        refs.preview.src = this.track(URL.createObjectURL(blob));
      } catch {
        refs.preview.removeAttribute('src');
      }
    }

    void this.updateCount();
  }

  async updateCount() {
    const count = (await this.collect()).length;

    this.refs.tabBrowse.textContent = count ? `Saved rounds (${count})` : 'Saved rounds';
  }

  track(url) {
    this.objectUrls.push(url);
    return url;
  }

  releaseUrls() {
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }

  // ── saving ────────────────────────────────────────────────────────────────

  async saveCurrent() {
    const { refs, app } = this;

    if (!app.requireImage('Load an image before saving a round.') || refs.saveButton.disabled) {
      return;
    }

    const title = refs.title.value.trim();
    const answer = refs.answer.value.trim();

    if (!title || !answer) {
      app.notify(`Add ${!title ? 'a title' : 'the answer'} first, so you have it when it's your turn.`, 'warning', 3600);
      (!title ? refs.title : refs.answer).focus();
      return;
    }

    const label = refs.saveButton.querySelector('span:last-child');

    refs.saveButton.disabled = true;
    label.textContent = this.saveMode === 'upload' ? 'Uploading…' : 'Saving…';

    try {
      if (this.saveMode === 'upload') {
        const url = await app.uploadForRis();

        app.roundStorage.addRound(url, title, answer);
        this.currentKey = `url:${url}`;
        app.notify('Round uploaded and saved with its link.', 'success');
      } else {
        const round = await app.saveLocalRound(title, answer);

        this.currentKey = `local:${round.id}`;
        app.notify(`Round saved in this browser (${formatSize(round.blob.size)}).`, 'success');
      }

      this.setTab('browse');
    } catch (error) {
      console.error(error);
      app.notify(`The round could not be saved. ${error?.message ?? ''}`.trim(), 'error', 5200);
    } finally {
      refs.saveButton.disabled = !app.store.hasImage;
      label.textContent = 'Save round';
    }
  }

  saveFromUrl() {
    const { refs, app } = this;
    const url = refs.urlUrl.value.trim();

    if (!/^https?:\/\/\S+$/i.test(url)) {
      app.notify('Enter the full image URL (https://…).', 'warning');
      refs.urlUrl.focus();
      return;
    }

    app.roundStorage.addRound(url, refs.urlTitle.value.trim(), refs.urlAnswer.value.trim());
    refs.urlUrl.value = '';
    refs.urlTitle.value = '';
    refs.urlAnswer.value = '';
    this.currentKey = `url:${url}`;
    app.notify('Round saved from URL.', 'success');
    this.setTab('browse');
  }

  // ── browsing ──────────────────────────────────────────────────────────────

  /** Rounds kept in this browser (newest first), then uploaded ones (newest first). */
  async collect() {
    const app = this.app;
    let local = [];

    try {
      local = (await app.localRounds.list()).map((round) => ({ kind: 'local', ...round })).reverse();
    } catch (error) {
      console.warn('Local rounds are unavailable', error);
    }

    const uploaded = app.roundStorage
      .getRounds()
      .map(([url, title, answer], index) => ({ kind: 'url', index, url, title, answer }))
      .reverse();

    return [...local, ...uploaded];
  }

  visibleRounds() {
    const query = this.query.trim().toLowerCase();

    return this.rounds.filter(
      (round) =>
        (this.filter === 'all' || round.kind === this.filter) &&
        (!query || `${round.title ?? ''} ${round.answer ?? ''}`.toLowerCase().includes(query))
    );
  }

  async refresh() {
    this.rounds = await this.collect();
    this.refs.tabBrowse.textContent = this.rounds.length ? `Saved rounds (${this.rounds.length})` : 'Saved rounds';

    if (this.currentKey && !this.rounds.some((round) => keyOf(round) === this.currentKey)) {
      this.currentKey = null;
    }

    this.renderBrowse();
  }

  imageFor(round) {
    if (round.kind === 'local') {
      round.src ??= this.track(URL.createObjectURL(round.blob));
      return round.src;
    }

    return round.url;
  }

  renderBrowse() {
    const panel = this.refs.browsePanel;

    if (!this.rounds.length) {
      panel.replaceChildren(
        el('div', { className: 'rounds-empty' }, [
          el('p', { textContent: 'No saved rounds yet.' }),
          el('p', { className: 'panel-intro-copy', textContent: 'Make a picture, then use “Save this round” to keep it ready for when you win.' }),
        ])
      );
      return;
    }

    const current = this.rounds.find((round) => keyOf(round) === this.currentKey);

    panel.replaceChildren(current ? this.renderDetail(current) : this.renderGrid());
  }

  renderGrid() {
    const search = el('input', { type: 'search', placeholder: 'Search titles and answers', 'aria-label': 'Search saved rounds', className: 'rounds-search' });
    const filter = el('select', { 'aria-label': 'Which rounds' }, [
      el('option', { value: 'all', textContent: 'All rounds' }),
      el('option', { value: 'local', textContent: 'In this browser' }),
      el('option', { value: 'url', textContent: 'Uploaded' }),
    ]);
    const answers = el('label', { className: 'rounds-toggle' }, [el('input', { type: 'checkbox' }), el('span', { textContent: 'Show answers' })]);
    const grid = el('div', { className: 'rounds-grid' });
    const fill = () => {
      const rounds = this.visibleRounds();

      grid.classList.toggle('rounds-grid--answers', this.showAnswers);
      grid.replaceChildren(...(rounds.length ? rounds.map((round) => this.renderCard(round)) : [el('p', { className: 'panel-intro-copy', textContent: 'No rounds match.' })]));
    };

    search.value = this.query;
    filter.value = this.filter;
    answers.querySelector('input').checked = this.showAnswers;
    search.addEventListener('input', () => {
      this.query = search.value;
      fill();
    });
    filter.addEventListener('change', () => {
      this.filter = filter.value;
      fill();
    });
    answers.querySelector('input').addEventListener('change', (event) => {
      this.showAnswers = event.target.checked;
      fill();
    });
    fill();

    return el('div', { className: 'stack' }, [el('div', { className: 'rounds-toolbar' }, [search, filter, answers]), grid]);
  }

  renderCard(round) {
    const card = el('button', { type: 'button', className: 'rounds-card', title: 'Open this round' }, [
      el('span', { className: 'rounds-card-thumb' }, [el('img', { src: this.imageFor(round), alt: '', loading: 'lazy' })]),
      el('span', { className: `rounds-badge ${round.kind === 'local' ? 'rounds-badge--local' : ''}`, textContent: round.kind === 'local' ? 'In this browser' : 'Uploaded' }),
      el('span', { className: 'rounds-card-title', textContent: round.title || 'Untitled' }),
      el('span', { className: 'rounds-card-answer', textContent: round.answer ? `Answer: ${round.answer}` : 'No answer saved' }),
    ]);

    card.addEventListener('click', () => {
      this.currentKey = keyOf(round);
      this.renderBrowse();
    });
    return card;
  }

  renderDetail(round) {
    const app = this.app;
    const rounds = this.visibleRounds().some((entry) => keyOf(entry) === keyOf(round)) ? this.visibleRounds() : this.rounds;
    const index = rounds.findIndex((entry) => keyOf(entry) === keyOf(round));
    const local = round.kind === 'local';
    const title = el('input', { type: 'text', maxlength: '285', 'aria-label': 'Round title', placeholder: 'Title' });
    const answer = el('input', { type: 'text', 'aria-label': 'Round answer', placeholder: 'Answer' });
    const prev = button('', { iconName: 'left', title: 'Previous round (←)', className: 'icon-button rounds-prev', onClick: () => this.step(-1) });
    const next = button('', { iconName: 'right', title: 'Next round (→)', className: 'icon-button rounds-next', onClick: () => this.step(1) });
    const confirm = el('div', { className: 'rounds-confirm hidden' }, [
      el('span', { textContent: 'Delete this round? This cannot be undone.' }),
      button('Delete', { className: 'app-button--danger', onClick: () => this.remove(round) }),
      button('Keep', { onClick: () => confirm.classList.add('hidden') }),
    ]);
    const save = async () => {
      if (title.value === (round.title ?? '') && answer.value === (round.answer ?? '')) {
        return;
      }

      round.title = title.value;
      round.answer = answer.value;

      if (local) {
        await app.localRounds.update(round.id, { title: title.value, answer: answer.value });
      } else {
        app.roundStorage.updateRound(round.index, title.value, answer.value);
      }

      app.notify('Round updated.', 'success', 1400);
    };

    title.value = round.title ?? '';
    answer.value = round.answer ?? '';
    title.addEventListener('change', save);
    answer.addEventListener('change', save);
    prev.disabled = index <= 0;
    next.disabled = index < 0 || index >= rounds.length - 1;

    const actions = [
      button(local ? 'Copy image & post' : 'Post to /r/PictureGame', {
        iconName: 'reddit',
        className: 'app-button--fill',
        title: local ? 'Copies the picture and opens the Reddit image post. Paste (Ctrl+V) there.' : 'Opens the Reddit submission with the link and title',
        onClick: () => this.post(round, title.value),
      }),
      ...(local && app.canShareFiles()
        ? [button('Share…', { iconName: 'share', title: 'Opens the share sheet with the picture, e.g. to post it from the Reddit app', onClick: () => app.shareImage(title.value, round.blob) })]
        : []),
      button('Check RIS', { iconName: 'search', title: local ? 'Uploads it (it then keeps its link) and searches it' : 'Searches the saved link', onClick: () => this.checkRis(round, title.value, answer.value) }),
      ...(local ? [button('Upload', { iconName: 'upload', title: `Upload to ${app.imageHosts.getHost().label} and keep the link`, onClick: (event) => this.upload(round, title.value, answer.value, event.currentTarget) })] : []),
      ...(!local ? [button('Copy link', { iconName: 'clipboard', onClick: () => app.copyText(round.url, 'Image URL copied.') })] : []),
      ...(!local ? [button('Copy YML', { onClick: () => app.copyYml({ roundTitle: title.value, roundAnswer: answer.value, imageUrl: round.url }) })] : []),
      button('Open in editor', { iconName: 'image', onClick: () => this.openInEditor(round) }),
      ...(local ? [button('Download', { iconName: 'download', onClick: () => this.download(round, title.value) })] : []),
      button('Delete', { iconName: 'trash', onClick: () => confirm.classList.remove('hidden') }),
    ];

    return el('div', { className: 'rounds-detail' }, [
      el('div', { className: 'rounds-detail-bar' }, [
        button('All rounds', { iconName: 'grid', onClick: () => this.back() }),
        el('span', { className: 'rounds-detail-count', textContent: index >= 0 ? `${index + 1} of ${rounds.length}` : '' }),
        prev,
        next,
      ]),
      el('div', { className: 'rounds-detail-body' }, [
        el('a', { className: 'rounds-detail-picture', href: this.imageFor(round), target: '_blank', rel: 'noopener', title: 'Open the full picture' }, [el('img', { src: this.imageFor(round), alt: round.title || 'Saved round' })]),
        el('div', { className: 'stack rounds-detail-side' }, [
          el('label', { className: 'field' }, [el('span', { className: 'field-label', textContent: 'Title' }), title]),
          el('label', { className: 'field' }, [el('span', { className: 'field-label', textContent: 'Answer' }), answer]),
          el('p', {
            className: 'panel-intro-copy',
            textContent: local
              ? `Kept in this browser · ${round.width} × ${round.height} · ${formatSize(round.blob.size)}${round.createdAt ? ` · saved ${formatDate(round.createdAt)}` : ''}`
              : 'Uploaded · the link is saved',
          }),
          row(actions, 'button-row--fill rounds-actions'),
          confirm,
        ]),
      ]),
    ]);
  }

  back() {
    this.currentKey = null;
    this.renderBrowse();
  }

  step(delta) {
    const rounds = this.visibleRounds().some((entry) => keyOf(entry) === this.currentKey) ? this.visibleRounds() : this.rounds;
    const index = rounds.findIndex((entry) => keyOf(entry) === this.currentKey);
    const target = rounds[index + delta];

    if (target) {
      this.currentKey = keyOf(target);
      this.renderBrowse();
    }
  }

  // ── round actions ─────────────────────────────────────────────────────────

  async post(round, title) {
    const app = this.app;

    if (round.kind === 'local') {
      await app.copyAndPost(title, 'picturegame', round.blob);
      return;
    }

    try {
      await app.redditPoster.postToReddit(round.url, title, 'picturegame');
      app.notify('Opened Reddit submission page.', 'success');
    } catch {
      app.notify('Could not open Reddit submission flow.', 'error');
    }
  }

  /** Uploads a local round; it then keeps its link instead of the picture. */
  async uploadLocal(round, title, answer) {
    const app = this.app;
    const url = await app.imageHosts.upload(round.blob);

    app.roundStorage.addRound(url, title, answer);
    await app.localRounds.remove(round.id);
    this.currentKey = `url:${url}`;
    return url;
  }

  async upload(round, title, answer, control) {
    control.disabled = true;

    try {
      await this.uploadLocal(round, title, answer);
      this.app.notify('Round uploaded. It now keeps its link instead of the local picture.', 'success', 3600);
      await this.refresh();
    } catch (error) {
      control.disabled = false;
      this.app.notify(`The upload failed. ${error.message}`, 'error', 4200);
    }
  }

  async checkRis(round, title, answer) {
    const app = this.app;

    if (round.kind !== 'local') {
      app.risChecker.check(round.url);
      return;
    }

    try {
      // The waiting tab opens inside this click; the upload finishes in the background.
      await app.risChecker.checkPending(() => this.uploadLocal(round, title, answer));
      await this.refresh();
    } catch (error) {
      app.notify(`The upload for the RIS check failed. ${error.message}`, 'error', 4200);
    }
  }

  async openInEditor(round) {
    const app = this.app;

    try {
      const blob = round.kind === 'local' ? round.blob : (await app.assets.fromUrl(round.url, { name: round.title || 'Saved round' })).blob;

      if (await app.openAsNewDocument(blob, round.title || 'Saved round')) {
        app.sharePanel.refs.title.value = round.title ?? '';
        app.sharePanel.refs.answer.value = round.answer ?? '';
        this.modal.close();
      }
    } catch (error) {
      console.error(error);
      app.notify('That round could not be loaded.', 'error');
    }
  }

  download(round, title) {
    const url = URL.createObjectURL(round.blob);
    const name = (title || 'round').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'round';
    const link = el('a', { href: url, download: `${name}.jpg` });

    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async remove(round) {
    const rounds = this.visibleRounds();
    const index = rounds.findIndex((entry) => keyOf(entry) === keyOf(round));
    const neighbour = rounds[index + 1] ?? rounds[index - 1];

    if (round.kind === 'local') {
      await this.app.localRounds.remove(round.id);
    } else {
      this.app.roundStorage.deleteRound(round.index);
    }

    this.currentKey = neighbour ? keyOf(neighbour) : null;
    this.app.notify('Round deleted.', 'success', 1600);
    await this.refresh();
  }
}
