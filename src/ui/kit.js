// Small DOM building blocks shared by the panels.

import { el } from '../utils/dom.js';

const ICONS = {
  select: '<path d="M5 3l14 7-6 2-2 6z"/>',
  brush: '<path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L11 16l-4 1 1-4z"/><path d="M7 17c-1.6 0-3 1-3 3 1.6.6 4 .3 5-1"/>',
  eraser: '<path d="M20 20H9l-5-5a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 2.8 0l5.4 5.400a2 2 0 0 1 0 2.800L12 20"/><path d="M8 10l6 6"/>',
  paint: '<path d="M14 5l5 5-9 9H5v-5z"/><path d="M4.500 3v3.500M2.800 4.700h3.400M19.500 15.500V20M17.300 17.700h4.400"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="2"/>',
  text: '<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
  region: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="2.500"/>',
  crop: '<path d="M7 2v15h15M2 7h15v15"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.300-4.300M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.300-4.300M8 11h6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  eye: '<path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.600 5.100A10.700 10.700 0 0 1 12 5c6.500 0 10 7 10 7a17 17 0 0 1-3.200 4M6.600 6.600A16.600 16.600 0 0 0 2 12s3.500 7 10 7c1.700 0 3.200-.400 4.500-1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.600-1.800"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  duplicate: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4V5a1 1 0 0 1 1-1h10v1"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/>',
  upload: '<path d="M12 17V5M7 10l5-5 5 5M4 21h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  shuffle: '<path d="M3 7h3c5 0 7 10 12 10h3M3 17h3c1.800 0 3.200-1.300 4.500-3M21 7h-3c-1.800 0-3.200 1.300-4.500 3M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  compare: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 3v18"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.500" cy="9.500" r="1.500"/><path d="M21 16l-5-5-9 9"/>',
  sparkle: '<path d="M11 3l1.900 5.100L18 10l-5.100 1.900L11 17l-1.900-5.100L4 10l5.100-1.900z"/><path d="M19 15v4M17 17h4"/>',
  pencil: '<path d="M4 20l1-5L16 4l4 4L9 19z"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  reset: '<path d="M4 4v6h6"/><path d="M4 10a8 8 0 1 1 2 6"/>',
  blur: '<path d="M12 3s6 6.200 6 11a6 6 0 0 1-12 0c0-4.800 6-11 6-11z"/><path d="M9.500 14.500a2.500 2.500 0 0 0 2.500 2.500"/>',
  pixel: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/><path d="M13 4h7v7M4 13v7h7" stroke-dasharray="2 2.500"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.010M15 15h.010M15 9h.010M9 15h.010M12 12h.010"/>',
  reddit: '<circle cx="12" cy="13" r="7"/><path d="M9.500 12.500h.010M14.500 12.500h.010M9.500 15.500c1.500 1 3.500 1 5 0M12 6l1-3 4 1"/>',
};

export function icon(name) {
  return el('span', {
    className: 'icon',
    'aria-hidden': 'true',
    innerHTML: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`,
  });
}

export function button(label, { onClick, className = '', iconName = '', title = '', id = '' } = {}) {
  const element = el('button', { type: 'button', className: `app-button ${className}`.trim() }, [
    ...(iconName ? [icon(iconName)] : []),
    ...(label ? [el('span', { textContent: label })] : []),
  ]);

  if (id) element.id = id;
  if (title) element.title = title;
  if (!label && title) element.setAttribute('aria-label', title);
  if (onClick) element.addEventListener('click', onClick);
  return element;
}

export function iconButton(iconName, title, onClick, className = '') {
  return button('', { iconName, title, onClick, className: `icon-button ${className}`.trim() });
}

function formatNumber(value, step) {
  return step < 1 ? Number(value).toFixed(String(step).split('.')[1]?.length ?? 1) : String(Math.round(value));
}

/** Labelled range input. Returns { element, set(value) }. */
export function slider({ label, min, max, step = 1, value, format = null, onInput, onChange }) {
  const input = el('input', {
    type: 'range',
    className: 'sliders',
    min: String(min),
    max: String(max),
    step: String(step),
    'aria-label': label,
  });
  const readout = el('span', { className: 'field-value' });
  const show = (current) => {
    readout.textContent = format ? format(current) : formatNumber(current, step);
  };

  input.value = String(value);
  show(value);
  input.addEventListener('input', () => {
    const current = Number(input.value);
    show(current);
    onInput?.(current);
  });
  input.addEventListener('change', () => onChange?.(Number(input.value)));

  return {
    element: el('label', { className: 'field field--slider' }, [
      el('span', { className: 'field-head' }, [el('span', { className: 'field-label', textContent: label }), readout]),
      input,
    ]),
    set(next) {
      if (document.activeElement !== input || Number(input.value) !== Number(next)) {
        input.value = String(next);
      }
      show(Number(next));
    },
  };
}

export function select({ label, options, value, onChange }) {
  const input = el(
    'select',
    { 'aria-label': label },
    options.map((option) => el('option', { value: String(option.value), textContent: option.label }))
  );

  input.value = String(value);
  input.addEventListener('change', () => onChange?.(input.value));

  return {
    element: el('label', { className: 'field field--inline' }, [el('span', { className: 'field-label', textContent: label }), input]),
    input,
    set(next) {
      input.value = String(next);
    },
  };
}

export function color({ label, value, onInput, onChange }) {
  const input = el('input', { type: 'color', 'aria-label': label });

  input.value = value;
  input.addEventListener('input', () => onInput?.(input.value));
  input.addEventListener('change', () => onChange?.(input.value));

  return {
    element: el('label', { className: 'field field--inline' }, [el('span', { className: 'field-label', textContent: label }), input]),
    input,
    set(next) {
      if (input.value !== next) {
        input.value = next;
      }
    },
  };
}

export function toggle({ label, value, onChange }) {
  const input = el('button', { type: 'button', className: 'app-button toggle-button', textContent: label, 'aria-pressed': 'false' });
  let state = Boolean(value);
  const show = () => {
    input.classList.toggle('is-active', state);
    input.setAttribute('aria-pressed', state ? 'true' : 'false');
  };

  show();
  input.addEventListener('click', () => {
    state = !state;
    show();
    onChange?.(state);
  });

  return {
    element: input,
    set(next) {
      state = Boolean(next);
      show();
    },
  };
}

export function row(children, className = '') {
  return el('div', { className: `button-row ${className}`.trim() }, children);
}

/** Collapsible group, styled like the classic tool sections. */
export function section(title, children, { open = true, className = '' } = {}) {
  return el('details', { className: `tool-section ${className}`.trim(), ...(open ? { open: '' } : {}) }, [
    el('summary', { className: 'tool-section-summary', textContent: title }),
    el('div', { className: 'tool-section-body' }, children),
  ]);
}

export function message(text = '', tone = 'info') {
  const element = el('div', { className: 'panel-inline-message hidden', 'aria-live': 'polite' });
  const set = (next = '', nextTone = 'info') => {
    element.textContent = next;
    element.className = `panel-inline-message ${next ? `panel-inline-message--${nextTone}` : 'hidden'}`;
  };

  set(text, tone);
  return { element, set };
}
