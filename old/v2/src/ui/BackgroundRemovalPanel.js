import { el } from '../utils/dom.js';

export class BackgroundRemovalPanel {
  constructor() {
    this.refs = {};
    this.element = this.render();
  }

  render() {
    this.refs.button = el('button', {
      id: 'backgroundRemoveButton',
      type: 'button',
      className: 'app-button',
      textContent: 'Remove background',
    });

    this.refs.progress = el('div', {
      className: 'ai-edit-progress hidden',
      'aria-live': 'polite',
    }, [
      el('span', { className: 'ai-edit-spinner', 'aria-hidden': 'true' }),
      el('span', {
        className: 'ai-edit-progress-label',
        textContent: 'Removing background',
      }),
    ]);

    this.refs.message = el('div', {
      className: 'panel-inline-message hidden',
      'aria-live': 'polite',
    });

    this.refs.root = el('fieldset', { id: 'backgroundRemovalPanel', className: 'panel-fieldset' }, [
      el('legend', { textContent: 'Background Removal' }),
      el('div', { className: 'button-row' }, [this.refs.button]),
      this.refs.progress,
      this.refs.message,
    ]);

    return this.refs.root;
  }

  setBusy(isBusy, message = 'Removing background') {
    this.refs.root.classList.toggle('is-busy', isBusy);
    this.refs.button.disabled = isBusy;
    this.refs.button.textContent = isBusy ? 'Removing...' : 'Remove background';
    this.refs.progress.classList.toggle('hidden', !isBusy);
    this.refs.progress.querySelector('.ai-edit-progress-label').textContent = message;
  }

  setMessage(message = '', tone = 'info') {
    this.refs.message.textContent = message;
    this.refs.message.className = `panel-inline-message ${message ? `panel-inline-message--${tone}` : 'hidden'}`.trim();
  }
}
