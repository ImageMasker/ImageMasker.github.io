// Settings dialog wiring: sessions, themes, keyboard shortcuts and the about page.

import { SessionPanel } from '../ui/SessionPanel.js';
import { SettingsModal } from '../ui/SettingsModal.js';
import { ShortcutsPanel } from '../ui/ShortcutsPanel.js';
import { ThemePanel } from '../ui/ThemePanel.js';
import { el } from '../utils/dom.js';
import { exportSessionJson } from './sessions.js';

function downloadText(text, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = el('a', { href: url, download: filename });

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export class SettingsUi {
  constructor(app) {
    this.app = app;
    this.modal = new SettingsModal();
    this.sessions = new SessionPanel();
    this.themes = new ThemePanel();
    this.shortcuts = new ShortcutsPanel();
    this.selectedSessionId = '';
    this.captureId = '';
    this.modal.refs.panels.sessions.append(this.sessions.element);
    this.modal.refs.panels.themes.append(this.themes.element);
    this.modal.refs.panels.shortcuts.append(this.shortcuts.element);
    this.modal.refs.panels.about.append(this.renderAbout());
    this.element = this.modal.element;
    this.bindSessions();
    this.bindThemes();
    this.bindShortcuts();
  }

  open(tab = 'sessions') {
    this.modal.setActiveTab(tab);
    this.modal.setOpen(true);
    this.renderSessions();
    this.modal.refs.closeButton.focus();
  }

  close() {
    this.modal.setOpen(false);
  }

  get isOpen() {
    return this.modal.isOpen;
  }

  renderAbout() {
    return el('section', { className: 'settings-section' }, [
      el('h2', { className: 'settings-section-title', textContent: 'Image Masker 3' }),
      el('p', {
        className: 'panel-intro-copy',
        textContent: 'Image masker for /r/PictureGame. Everything runs in your browser: pictures are only sent anywhere when you upload them or use an AI service.',
      }),
      el('p', {
        className: 'panel-intro-copy',
        textContent: 'Version 3 renders with its own WebGL2 engine. Overlay masks, effect masks, text and drawings are all non-destructive layers, and exports are rendered at the full resolution of your picture.',
      }),
      el('div', { className: 'session-actions-row' }, [
        el('a', { className: 'app-button link-button', href: 'old/v2/', textContent: 'Open the previous version' }),
        el('a', {
          className: 'app-button link-button',
          href: 'https://github.com/ImageMasker/ImageMasker.github.io',
          target: '_blank',
          rel: 'noopener',
          textContent: 'Source on GitHub',
        }),
      ]),
    ]);
  }

  // ── sessions ──────────────────────────────────────────────────────────────

  async renderSessions() {
    try {
      const sessions = await this.app.sessionStore.list();

      this.sessions.renderSessions(sessions.map((session) => ({ ...session, canRestore: true })), this.selectedSessionId);
    } catch {
      this.sessions.setStatus('Saved sessions are not available in this browser.', 'warning');
    }
  }

  showRestorePrompt(show) {
    if (show) {
      this.sessions.showRestorePrompt({ canRestore: true });
    } else {
      this.sessions.hideRestorePrompt();
    }
  }

  bindSessions() {
    const app = this.app;
    const refs = this.sessions.refs;
    const guard = async (action, failure) => {
      try {
        await action();
      } catch (error) {
        this.sessions.setStatus(`${failure} ${error?.message ?? ''}`.trim(), 'error');
      }
    };

    this.sessions.setStatus('Sessions are stored in this browser, pictures included.', 'info');
    refs.restoreButton.addEventListener('click', () => app.restoreAutosave());
    refs.discardButton.addEventListener('click', () => app.discardAutosave());
    refs.sessionSelect.addEventListener('change', () => {
      this.selectedSessionId = refs.sessionSelect.value;
      refs.sessionNameInput.value = refs.sessionSelect.selectedOptions[0]?.textContent ?? '';

      if (!this.selectedSessionId) {
        refs.sessionNameInput.value = '';
      }
    });
    refs.saveButton.addEventListener('click', () =>
      guard(async () => {
        if (!app.requireImage('Load an image before saving a session.')) {
          return;
        }

        const name = refs.sessionNameInput.value.trim() || `Session ${new Date().toLocaleString()}`;
        const sameName = refs.sessionSelect.selectedOptions[0]?.textContent === name;
        const id = this.selectedSessionId && sameName ? this.selectedSessionId : `session-${Date.now().toString(36)}`;

        await app.saveSession(id, name);
        this.selectedSessionId = id;
        await this.renderSessions();
        this.sessions.setStatus(`Session "${name}" saved.`, 'success');
      }, 'Could not save the session.')
    );
    refs.loadButton.addEventListener('click', () =>
      guard(async () => {
        if (!this.selectedSessionId) {
          this.sessions.setStatus('Select a saved session first.', 'warning');
          return;
        }

        const dropped = await app.loadSession(this.selectedSessionId);

        this.sessions.setStatus(
          dropped.length ? `Session loaded, but these layers could not be restored: ${dropped.join(', ')}.` : 'Session loaded.',
          dropped.length ? 'warning' : 'success'
        );
        this.close();
      }, 'Could not load the session.')
    );
    refs.duplicateButton.addEventListener('click', () =>
      guard(async () => {
        const stored = this.selectedSessionId ? await app.sessionStore.load(this.selectedSessionId) : null;

        if (!stored) {
          this.sessions.setStatus('Select a saved session first.', 'warning');
          return;
        }

        const id = `session-${Date.now().toString(36)}`;
        const records = new Map(stored.assets.map((record) => [record.id, record]));

        await app.sessionStore.save({ ...stored.session, id, name: `${stored.session.name} copy`, updatedAt: new Date().toISOString() }, records);
        this.selectedSessionId = id;
        await this.renderSessions();
        this.sessions.setStatus('Session duplicated.', 'success');
      }, 'Could not duplicate the session.')
    );
    refs.deleteButton.addEventListener('click', () =>
      guard(async () => {
        if (!this.selectedSessionId) {
          this.sessions.setStatus('Select a saved session first.', 'warning');
          return;
        }

        await app.sessionStore.remove(this.selectedSessionId);
        this.selectedSessionId = '';
        refs.sessionNameInput.value = '';
        await this.renderSessions();
        this.sessions.setStatus('Session deleted.', 'success');
      }, 'Could not delete the session.')
    );
    refs.exportButton.addEventListener('click', () =>
      guard(async () => {
        if (!app.requireImage('Load an image before exporting a session.')) {
          return;
        }

        downloadText(await exportSessionJson(app), `imagemasker-session-${new Date().toISOString().slice(0, 10)}.json`);
        this.sessions.setStatus('Session exported.', 'success');
      }, 'Could not export the session.')
    );
    refs.importButton.addEventListener('click', () => refs.importInput.click());
    refs.importInput.addEventListener('change', () =>
      guard(async () => {
        const [file] = refs.importInput.files ?? [];

        refs.importInput.value = '';

        if (!file) {
          return;
        }

        const dropped = await app.importSession(JSON.parse(await file.text()));

        this.sessions.setStatus(
          dropped.length ? `Session imported, but these layers could not be restored: ${dropped.join(', ')}.` : 'Session imported.',
          dropped.length ? 'warning' : 'success'
        );
        this.close();
      }, 'Could not import that session.')
    );
  }

  // ── themes ────────────────────────────────────────────────────────────────

  renderThemes() {
    const manager = this.app.themeManager;
    const active = manager.getActiveTheme();

    this.themes.renderThemes(manager.getThemes(), active.id);
    this.themes.setSummary(manager.describeTheme(active.id));
    this.themes.refs.deleteButton.disabled = active.builtin;
  }

  bindThemes() {
    const manager = this.app.themeManager;
    const refs = this.themes.refs;
    const applied = () => {
      this.renderThemes();
      this.app.stage?.requestFrame();
    };

    refs.themeSelect.addEventListener('change', () => {
      manager.applyTheme(refs.themeSelect.value);
      applied();
      this.themes.setStatus('Theme applied.', 'success');
    });
    refs.importButton.addEventListener('click', () => refs.importInput.click());
    refs.importInput.addEventListener('change', async () => {
      const [file] = refs.importInput.files ?? [];

      if (!file) {
        return;
      }

      try {
        const theme = manager.importTheme(JSON.parse(await file.text()), file.name.replace(/\.json$/i, '') || 'Imported theme');

        applied();
        this.themes.setStatus(`Theme "${theme.name}" imported.`, 'success');
      } catch {
        this.themes.setStatus('Could not import that theme JSON.', 'error');
      } finally {
        refs.importInput.value = '';
      }
    });
    refs.exportButton.addEventListener('click', () => {
      const theme = manager.getActiveTheme();
      const exported = manager.exportTheme(theme?.id);

      if (!theme || !exported) {
        this.themes.setStatus('No theme selected to export.', 'warning');
        return;
      }

      downloadText(JSON.stringify(exported, null, 2), `${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'theme'}.imagemasker-theme.json`);
      this.themes.setStatus('Theme exported.', 'success');
    });
    refs.deleteButton.addEventListener('click', () => {
      const theme = manager.getThemeById(refs.themeSelect.value);

      if (!theme || theme.builtin) {
        this.themes.setStatus('Built-in themes cannot be deleted.', 'warning');
        return;
      }

      manager.deleteTheme(theme.id);
      applied();
      this.themes.setStatus(`Theme "${theme.name}" deleted.`, 'success');
    });
  }

  // ── shortcuts ─────────────────────────────────────────────────────────────

  renderShortcuts() {
    const keyboard = this.app.keyboard;

    this.shortcuts.renderCommands(keyboard.getCommands(), (binding) => keyboard.formatBinding(binding));
    this.app.updateShortcutHints();
  }

  bindShortcuts() {
    const refs = this.shortcuts.refs;

    refs.resetButton.addEventListener('click', () => {
      this.app.keyboard.resetAllBindings();
      this.captureId = '';
      this.shortcuts.setCapture('');
      this.shortcuts.setMessage('Shortcuts reset to defaults.', 'success');
      this.renderShortcuts();
    });
    refs.list.addEventListener('click', (event) => {
      const capture = event.target.closest('[data-shortcut-command]');
      const reset = event.target.closest('[data-shortcut-reset]');

      if (capture) {
        this.captureId = capture.dataset.shortcutCommand;
        this.shortcuts.setCapture(this.captureId);
        this.shortcuts.setMessage('Press the new shortcut.', 'info');
        this.renderShortcuts();
      } else if (reset) {
        this.app.keyboard.resetBinding(reset.dataset.shortcutReset);
        this.shortcuts.setMessage('Shortcut reset.', 'success');
        this.renderShortcuts();
      }
    });
    document.addEventListener(
      'keydown',
      (event) => {
        if (!this.captureId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.key === 'Escape') {
          this.captureId = '';
          this.shortcuts.setCapture('');
          this.shortcuts.setMessage('Shortcut capture cancelled.', 'info');
          this.renderShortcuts();
          return;
        }

        const binding = this.app.keyboard.eventToBinding(event);

        if (!binding) {
          return;
        }

        const result = this.app.keyboard.setBinding(this.captureId, binding);

        this.captureId = '';
        this.shortcuts.setCapture('');
        this.shortcuts.setMessage(result.message, result.ok ? 'success' : 'warning');
        this.renderShortcuts();
      },
      true
    );
  }
}
