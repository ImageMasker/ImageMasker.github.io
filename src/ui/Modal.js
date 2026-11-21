// A dialog in the same style as Settings (same classes, so JSON themes style it too).

import { el } from '../utils/dom.js';

const open = new Set();

export class Modal {
  /** True while any Modal is showing (keyboard shortcuts and paste-to-canvas pause then). */
  static anyOpen() {
    return open.size > 0;
  }

  constructor({ title, intro = '', className = '', onClose = null }) {
    this.onClose = onClose;
    this.titleId = `modal-${Math.random().toString(36).slice(2, 8)}`;
    this.body = el('div', { className: 'settings-modal-body app-modal-body' });
    this.headerExtra = el('div', { className: 'app-modal-header-extra' });

    const close = el('button', { type: 'button', className: 'settings-modal-close', textContent: 'Close', 'aria-label': `Close ${title}` });

    this.dialog = el('div', { className: `settings-modal app-modal ${className}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': this.titleId }, [
      el('div', { className: 'settings-modal-header' }, [
        el('div', { className: 'settings-modal-heading' }, [
          el('h1', { id: this.titleId, className: 'settings-modal-title', textContent: title }),
          ...(intro ? [el('p', { className: 'panel-intro-copy', textContent: intro })] : []),
        ]),
        this.headerExtra,
        close,
      ]),
      this.body,
    ]);
    this.element = el('div', { className: 'settings-modal-overlay app-modal-overlay hidden', 'aria-hidden': 'true' }, [this.dialog]);
    close.addEventListener('click', () => this.close());
    this.element.addEventListener('pointerdown', (event) => {
      this.downOnOverlay = event.target === this.element;
    });
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element && this.downOnOverlay) {
        this.close();
      }
    });
    this.onKey = (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.stopPropagation();
        this.close();
      }
    };
  }

  get isOpen() {
    return open.has(this);
  }

  open() {
    if (this.isOpen) {
      return;
    }

    open.add(this);
    this.element.classList.remove('hidden');
    this.element.setAttribute('aria-hidden', 'false');
    document.body.classList.add('settings-modal-open');
    document.addEventListener('keydown', this.onKey, true);
  }

  close() {
    if (!this.isOpen) {
      return;
    }

    open.delete(this);
    this.element.classList.add('hidden');
    this.element.setAttribute('aria-hidden', 'true');
    document.body.classList.toggle('settings-modal-open', open.size > 0);
    document.removeEventListener('keydown', this.onKey, true);
    this.onClose?.();
  }
}
