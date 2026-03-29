import { el } from '../utils/dom.js';

export class ToastManager {
  constructor() {
    this.refs = {};
    this.timeouts = new Map();
    this.element = this.render();
  }

  render() {
    this.refs.root = el('div', {
      className: 'toast-stack',
      'aria-live': 'polite',
      'aria-atomic': 'false',
    });

    return this.refs.root;
  }

  show(message, tone = 'info', duration = 2400) {
    const toast = el('div', {
      className: `toast toast--${tone}`,
      role: 'status',
      textContent: message,
    });

    this.refs.root.appendChild(toast);

    const timeoutId = window.setTimeout(() => {
      toast.classList.add('toast--leaving');
      window.setTimeout(() => {
        toast.remove();
        this.timeouts.delete(toast);
      }, 180);
    }, duration);

    this.timeouts.set(toast, timeoutId);
    return toast;
  }
}
