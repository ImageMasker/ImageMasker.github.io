import { el } from '../utils/dom.js';

export class ShortcutsPanel {
  constructor() {
    this.refs = {};
    this.captureCommandId = '';
    this.element = this.render();
  }

  render() {
    this.refs.message = el('div', {
      className: 'panel-inline-message hidden',
    });
    this.refs.resetButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Reset to defaults',
    });
    this.refs.list = el('div', {
      className: 'shortcut-list',
    });
    this.refs.root = el('div', { className: 'shortcut-panel' }, [
      el('div', { className: 'shortcut-panel-header' }, [
        el('p', {
          className: 'panel-intro-copy',
          textContent: 'Remap editor commands. Browser-reserved shortcuts may still be intercepted before the app sees them.',
        }),
        this.refs.resetButton,
      ]),
      this.refs.message,
      this.refs.list,
    ]);

    return this.refs.root;
  }

  renderCommands(commands, formatBinding) {
    const groups = new Map();

    for (const command of commands) {
      const group = groups.get(command.category) ?? [];
      group.push(command);
      groups.set(command.category, group);
    }

    this.refs.list.replaceChildren(
      ...[...groups.entries()].map(([category, items]) => el('section', {
        className: 'shortcut-group',
      }, [
        el('h3', {
          className: 'shortcut-group-title',
          textContent: category,
        }),
        ...items.map((command) => this.createCommandRow(command, formatBinding)),
      ]))
    );
  }

  createCommandRow(command, formatBinding) {
    const isCapturing = this.captureCommandId === command.id;

    return el('div', {
      className: 'shortcut-row',
      'data-command-id': command.id,
    }, [
      el('div', { className: 'shortcut-row-main' }, [
        el('div', {
          className: 'shortcut-label',
          textContent: command.label,
        }),
      ]),
      el('button', {
        type: 'button',
        className: `app-button shortcut-capture-button ${isCapturing ? 'is-active' : ''}`.trim(),
        'data-shortcut-command': command.id,
        textContent: isCapturing ? 'Press keys…' : formatBinding(command.binding),
      }),
      el('button', {
        type: 'button',
        className: 'app-button shortcut-reset-button',
        'data-shortcut-reset': command.id,
        textContent: 'Reset',
      }),
    ]);
  }

  setCapture(commandId = '') {
    this.captureCommandId = commandId;
  }

  setMessage(message = '', tone = 'info') {
    this.refs.message.className = `panel-inline-message ${message ? `panel-inline-message--${tone}` : 'hidden'}`.trim();
    this.refs.message.textContent = message;
  }
}
