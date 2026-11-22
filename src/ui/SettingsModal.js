import { el } from '../utils/dom.js';

const TABS = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'themes', label: 'Themes' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'masks', label: 'Masks' },
  { id: 'about', label: 'About' },
];

export class SettingsModal {
  constructor() {
    this.refs = { tabs: {}, panels: {} };
    this.element = this.render();
  }

  render() {
    for (const tab of TABS) {
      this.refs.tabs[tab.id] = el('button', {
        type: 'button',
        className: 'settings-tab-button',
        textContent: tab.label,
        'data-settings-tab': tab.id,
        'aria-pressed': 'false',
      });
      this.refs.tabs[tab.id].addEventListener('click', () => this.setActiveTab(tab.id));
      this.refs.panels[tab.id] = el('div', { className: 'settings-tab-panel hidden', 'data-settings-panel': tab.id });
    }

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
          el('h1', { id: 'settingsModalTitle', className: 'settings-modal-title', textContent: 'Settings' }),
          el('p', {
            className: 'panel-intro-copy',
            textContent: 'Manage saved sessions, visual themes and keyboard shortcuts without leaving the editor.',
          }),
        ]),
        this.refs.closeButton,
      ]),
      el('div', { className: 'settings-tab-list' }, Object.values(this.refs.tabs)),
      el('div', { className: 'settings-modal-body' }, Object.values(this.refs.panels)),
    ]);
    this.refs.overlay = el('div', { className: 'settings-modal-overlay hidden', 'aria-hidden': 'true' }, [this.refs.dialog]);
    this.refs.closeButton.addEventListener('click', () => this.setOpen(false));
    this.refs.overlay.addEventListener('click', (event) => {
      if (event.target === this.refs.overlay) {
        this.setOpen(false);
      }
    });
    this.setActiveTab('sessions');
    return this.refs.overlay;
  }

  get isOpen() {
    return !this.refs.overlay.classList.contains('hidden');
  }

  setOpen(isOpen) {
    this.refs.overlay.classList.toggle('hidden', !isOpen);
    this.refs.overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    document.body.classList.toggle('settings-modal-open', isOpen);
  }

  setActiveTab(tab) {
    const active = this.refs.tabs[tab] ? tab : 'sessions';

    for (const { id } of TABS) {
      this.refs.tabs[id].classList.toggle('is-active', id === active);
      this.refs.tabs[id].setAttribute('aria-pressed', id === active ? 'true' : 'false');
      this.refs.panels[id].classList.toggle('hidden', id !== active);
    }
  }
}
