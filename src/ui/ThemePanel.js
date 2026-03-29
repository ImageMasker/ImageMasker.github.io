import { el } from '../utils/dom.js';

export class ThemePanel {
  constructor() {
    this.refs = {};
    this.element = this.render();
  }

  render() {
    this.refs.themeSelect = el('select', {
      id: 'themeSelect',
      'aria-label': 'Theme selection',
    });
    this.refs.importButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Upload JSON',
    });
    this.refs.importInput = el('input', {
      type: 'file',
      accept: '.json,application/json',
      className: 'visually-hidden',
    });
    this.refs.exportButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Export theme',
    });
    this.refs.deleteButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Delete theme',
    });
    this.refs.summary = el('div', {
      className: 'theme-summary panel-inline-message panel-inline-message--info',
    });
    this.refs.status = el('div', {
      className: 'theme-status panel-inline-message hidden',
    });

    this.refs.root = el('section', { className: 'settings-section theme-panel' }, [
      el('div', { className: 'settings-section-header' }, [
        el('h2', { className: 'settings-section-title', textContent: 'Themes' }),
        el('p', {
          className: 'panel-intro-copy',
          textContent: 'Switch between built-in looks or upload JSON themes with color variables, layout hints, and optional custom CSS.',
        }),
      ]),
      el('div', { className: 'settings-grid' }, [
        el('label', { className: 'settings-field' }, [
          el('span', { className: 'field-label', textContent: 'Active theme' }),
          this.refs.themeSelect,
        ]),
      ]),
      el('div', { className: 'session-actions-row' }, [
        this.refs.importButton,
        this.refs.exportButton,
        this.refs.deleteButton,
        this.refs.importInput,
      ]),
      this.refs.summary,
      el('pre', {
        className: 'theme-format-preview',
        textContent: '{\n  "name": "Example theme",\n  "base": "dark",\n  "vars": {\n    "--bg-panel": "#223044"\n  },\n  "layout": {\n    "columns": "mirrored",\n    "chrome": "top-left"\n  },\n  "cssText": ".tool-section { border-radius: 18px; }"\n}',
      }),
      this.refs.status,
    ]);

    return this.refs.root;
  }

  renderThemes(themes, selectedId) {
    this.refs.themeSelect.replaceChildren(
      ...themes.map((theme) =>
        el('option', {
          value: theme.id,
          textContent: theme.builtin ? `${theme.name} (built-in)` : theme.name,
        })
      )
    );

    if (themes.some((theme) => theme.id === selectedId)) {
      this.refs.themeSelect.value = selectedId;
    }
  }

  setSummary(message) {
    this.refs.summary.textContent = message ?? '';
  }

  setStatus(message = '', tone = 'info') {
    this.refs.status.textContent = message;
    this.refs.status.className = `theme-status panel-inline-message ${message ? `panel-inline-message--${tone}` : 'hidden'}`.trim();
  }
}
