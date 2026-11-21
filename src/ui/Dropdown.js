// A small popover anchored under a button (the ▾ menus in the header). Stays open while its
// checkboxes are clicked; closes on an outside click, Escape or a resize.

import { el } from '../utils/dom.js';

export class Dropdown {
  constructor(toggleButton, { label = '', className = '' } = {}) {
    this.toggleButton = toggleButton;
    this.element = el('div', { className: `context-menu dropdown-menu hidden ${className}`.trim(), role: 'menu', 'aria-label': label });
    this.close = this.close.bind(this);
    this.onOutside = (event) => {
      if (!this.element.contains(event.target) && !toggleButton.contains(event.target)) {
        this.close();
      }
    };
    this.onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
        toggleButton.focus();
      }
    };
    toggleButton.setAttribute('aria-haspopup', 'true');
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleButton.addEventListener('click', () => this.toggle());
  }

  get isOpen() {
    return !this.element.classList.contains('hidden');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    const { element, toggleButton } = this;
    const anchor = (toggleButton.closest('.split-button') ?? toggleButton).getBoundingClientRect();

    element.classList.remove('hidden');
    toggleButton.setAttribute('aria-expanded', 'true');
    element.style.top = `${anchor.bottom + 6}px`;
    element.style.left = `${Math.max(4, Math.min(anchor.right - element.offsetWidth, window.innerWidth - element.offsetWidth - 4))}px`;
    element.querySelector('input, button')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', this.onOutside, true);
    document.addEventListener('keydown', this.onKey, true);
    window.addEventListener('resize', this.close);
  }

  close() {
    this.element.classList.add('hidden');
    this.toggleButton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('resize', this.close);
  }
}

/** A titled group of checkboxes or radio buttons for a Dropdown. */
export function choiceGroup({ title, type = 'checkbox', name = '', options, isChecked, onChange }) {
  const inputs = options.map((option) => {
    const input = el('input', { type, name, value: option.id, 'aria-label': option.label });

    input.checked = isChecked(option.id);
    input.addEventListener('change', () => onChange(option.id, input, inputs));
    return input;
  });

  return [
    el('div', { className: 'dropdown-title', textContent: title }),
    ...options.map((option, index) =>
      el('label', { className: 'context-menu-item dropdown-item', title: option.note ?? '' }, [inputs[index], el('span', { className: 'context-menu-label', textContent: option.label })])
    ),
  ];
}
