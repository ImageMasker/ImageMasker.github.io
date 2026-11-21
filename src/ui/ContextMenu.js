// A small right-click menu. Items: { label, icon, shortcut, action, disabled } or 'separator'.

import { el } from '../utils/dom.js';
import { icon } from './kit.js';

export class ContextMenu {
  constructor() {
    this.element = el('div', { className: 'context-menu hidden', role: 'menu' });
    this.close = this.close.bind(this);
    this.onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    };
  }

  open(clientX, clientY, items) {
    this.element.replaceChildren(
      ...items.filter(Boolean).map((item) => {
        if (item === 'separator') {
          return el('div', { className: 'context-menu-separator', role: 'separator' });
        }

        const entry = el('button', { type: 'button', className: 'context-menu-item', role: 'menuitem' }, [
          item.icon ? icon(item.icon) : el('span', { className: 'icon' }),
          el('span', { className: 'context-menu-label', textContent: item.label }),
          el('span', { className: 'context-menu-shortcut', textContent: item.shortcut ?? '' }),
        ]);

        entry.disabled = Boolean(item.disabled);
        entry.addEventListener('click', () => {
          this.close();
          item.action?.();
        });
        return entry;
      })
    );
    this.element.classList.remove('hidden');

    // Keep the menu inside the window.
    const { offsetWidth: width, offsetHeight: height } = this.element;

    this.element.style.left = `${Math.max(4, Math.min(clientX, window.innerWidth - width - 4))}px`;
    this.element.style.top = `${Math.max(4, Math.min(clientY, window.innerHeight - height - 4))}px`;
    this.element.querySelector('.context-menu-item:not(:disabled)')?.focus({ preventScroll: true });

    setTimeout(() => {
      document.addEventListener('pointerdown', this.onOutside = (event) => !this.element.contains(event.target) && this.close(), true);
      document.addEventListener('keydown', this.onKey, true);
      window.addEventListener('blur', this.close);
      window.addEventListener('resize', this.close);
    }, 0);
  }

  close() {
    if (this.element.classList.contains('hidden')) {
      return;
    }

    this.element.classList.add('hidden');
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('blur', this.close);
    window.removeEventListener('resize', this.close);
  }
}
