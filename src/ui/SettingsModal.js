import { el } from '../utils/dom.js';

export class SettingsModal {
  constructor() {
    this.refs = {};
    this.element = this.render();
  }

  render() {
    this.refs.sessionsTabButton = el('button', {
      type: 'button',
      className: 'settings-tab-button is-active',
      textContent: 'Sessions',
      'data-settings-tab': 'sessions',
      'aria-pressed': 'true',
    });
    this.refs.themesTabButton = el('button', {
      type: 'button',
      className: 'settings-tab-button',
      textContent: 'Themes',
      'data-settings-tab': 'themes',
      'aria-pressed': 'false',
    });
    this.refs.shortcutsTabButton = el('button', {
      type: 'button',
      className: 'settings-tab-button',
      textContent: 'Shortcuts',
      'data-settings-tab': 'shortcuts',
      'aria-pressed': 'false',
    });
    this.refs.sessionsContent = el('div', {
      className: 'settings-tab-panel',
      'data-settings-panel': 'sessions',
    });
    this.refs.themesContent = el('div', {
      className: 'settings-tab-panel hidden',
      'data-settings-panel': 'themes',
    });
    this.refs.shortcutsContent = el('div', {
      className: 'settings-tab-panel hidden',
      'data-settings-panel': 'shortcuts',
    });
    this.refs.closeButton = el('button', {
      type: 'button',
      className: 'settings-modal-close',
      textContent: 'Close',
      'aria-label': 'Close settings',
    });
    this.refs.dialog = el('div', {
      className: 'settings-modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'settingsModalTitle',
    }, [
      el('div', { className: 'settings-modal-header' }, [
        el('div', { className: 'settings-modal-heading' }, [
          el('h1', {
            id: 'settingsModalTitle',
            className: 'settings-modal-title',
            textContent: 'Settings',
          }),
          el('p', {
            className: 'panel-intro-copy',
            textContent: 'Manage saved sessions and visual themes without leaving the editor.',
          }),
        ]),
        this.refs.closeButton,
      ]),
      el('div', { className: 'settings-tab-list' }, [
        this.refs.sessionsTabButton,
        this.refs.themesTabButton,
        this.refs.shortcutsTabButton,
      ]),
      el('div', { className: 'settings-modal-body' }, [
        this.refs.sessionsContent,
        this.refs.themesContent,
        this.refs.shortcutsContent,
      ]),
    ]);
    this.refs.overlay = el('div', {
      className: 'settings-modal-overlay hidden',
      'aria-hidden': 'true',
    }, [
      this.refs.dialog,
    ]);

    return this.refs.overlay;
  }

  setOpen(isOpen) {
    this.refs.overlay.classList.toggle('hidden', !isOpen);
    this.refs.overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    document.body.classList.toggle('settings-modal-open', isOpen);
  }

  setActiveTab(tab) {
    const nextTab = ['sessions', 'themes', 'shortcuts'].includes(tab) ? tab : 'sessions';
    const isSessions = nextTab === 'sessions';
    const isThemes = nextTab === 'themes';
    const isShortcuts = nextTab === 'shortcuts';

    this.refs.sessionsTabButton.classList.toggle('is-active', isSessions);
    this.refs.sessionsTabButton.setAttribute('aria-pressed', isSessions ? 'true' : 'false');
    this.refs.themesTabButton.classList.toggle('is-active', isThemes);
    this.refs.themesTabButton.setAttribute('aria-pressed', isThemes ? 'true' : 'false');
    this.refs.shortcutsTabButton.classList.toggle('is-active', isShortcuts);
    this.refs.shortcutsTabButton.setAttribute('aria-pressed', isShortcuts ? 'true' : 'false');
    this.refs.sessionsContent.classList.toggle('hidden', !isSessions);
    this.refs.themesContent.classList.toggle('hidden', !isThemes);
    this.refs.shortcutsContent.classList.toggle('hidden', !isShortcuts);
  }
}
