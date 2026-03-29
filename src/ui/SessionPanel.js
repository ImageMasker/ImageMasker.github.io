import { el } from '../utils/dom.js';

export class SessionPanel {
  constructor() {
    this.refs = {};
    this.element = this.render();
  }

  render() {
    this.refs.restoreMessage = el('div', { className: 'session-restore-message' });
    this.refs.restoreButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Restore',
    });
    this.refs.discardButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Discard',
    });
    this.refs.restorePrompt = el('div', { className: 'session-restore-banner hidden' }, [
      this.refs.restoreMessage,
      el('div', { className: 'session-actions-row' }, [
        this.refs.restoreButton,
        this.refs.discardButton,
      ]),
    ]);

    this.refs.sessionSelect = el('select', {
      id: 'sessionSelect',
      'aria-label': 'Saved sessions',
    }, [
      el('option', { value: '', textContent: 'Select a saved session' }),
    ]);
    this.refs.sessionNameInput = el('input', {
      id: 'sessionName',
      type: 'text',
      placeholder: 'Session name',
      'aria-label': 'Session name',
    });
    this.refs.saveButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Save current',
    });
    this.refs.loadButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Load selected',
    });
    this.refs.duplicateButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Duplicate',
    });
    this.refs.deleteButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Delete',
    });
    this.refs.exportButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Export JSON',
    });
    this.refs.importButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Import JSON',
    });
    this.refs.importInput = el('input', {
      type: 'file',
      accept: '.json,application/json',
      className: 'visually-hidden',
    });
    this.refs.status = el('div', {
      className: 'session-status panel-inline-message panel-inline-message--info',
    });

    this.refs.root = el('section', { className: 'settings-section session-panel' }, [
      el('div', { className: 'settings-section-header' }, [
        el('h2', { className: 'settings-section-title', textContent: 'Sessions' }),
        el('p', {
          className: 'panel-intro-copy',
          textContent: 'Save work across reloads, restore autosaves, or move documents around as JSON.',
        }),
      ]),
      this.refs.restorePrompt,
      el('div', { className: 'settings-grid' }, [
        el('label', { className: 'settings-field' }, [
          el('span', { className: 'field-label', textContent: 'Saved sessions' }),
          this.refs.sessionSelect,
        ]),
        el('label', { className: 'settings-field' }, [
          el('span', { className: 'field-label', textContent: 'Session name' }),
          this.refs.sessionNameInput,
        ]),
      ]),
      el('div', { className: 'session-actions-row' }, [
        this.refs.saveButton,
        this.refs.loadButton,
        this.refs.duplicateButton,
        this.refs.deleteButton,
      ]),
      el('div', { className: 'session-actions-row' }, [
        this.refs.exportButton,
        this.refs.importButton,
        this.refs.importInput,
      ]),
      this.refs.status,
    ]);

    return this.refs.root;
  }

  renderSessions(sessions, selectedId = '') {
    this.refs.sessionSelect.replaceChildren(
      el('option', { value: '', textContent: 'Select a saved session' }),
      ...sessions.map((session) =>
        el('option', {
          value: session.id,
          textContent: session.canRestore ? session.name : `${session.name} (local image)`,
        })
      )
    );

    this.refs.sessionSelect.value = sessions.some((session) => session.id === selectedId)
      ? selectedId
      : '';
  }

  showRestorePrompt(sessionDocument) {
    this.refs.restorePrompt.classList.remove('hidden');
    this.refs.restoreButton.disabled = !sessionDocument?.canRestore;
    this.refs.restoreMessage.textContent = sessionDocument?.canRestore
      ? 'Restore the last autosaved session?'
      : 'An autosave was found, but it used a local image and cannot be restored automatically.';
  }

  hideRestorePrompt() {
    this.refs.restorePrompt.classList.add('hidden');
  }

  setStatus(message, tone = 'info') {
    this.refs.status.textContent = message ?? '';
    this.refs.status.className = `session-status panel-inline-message ${message ? `panel-inline-message--${tone}` : 'hidden'}`.trim();
  }
}
