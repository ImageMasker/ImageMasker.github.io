// The emoji picker for emoji masks and the stamp tool: a popover with search, category tabs,
// recently used emojis, the PictureGame server's emojis and every Unicode emoji.
//
// The full emoji list (names, keywords, groups) is Emojibase's, loaded from jsDelivr the first time
// the picker opens and kept for the visit; until it arrives (or when offline) the picker shows the
// built-in palette from masks/emojiData.js. Emojis are shown in the style they will be drawn in.
//
//   const picker = new EmojiPicker(app);
//   picker.open(anchorButton, { style, multiple, isActive(emoji), onPick(emoji) });

import { EMOJI_PALETTE, SERVER_EMOJIS } from '../masks/emojiData.js';
import { emojiGlyph } from '../raster/emojiArt.js';
import { el } from '../utils/dom.js';
import { iconButton } from './kit.js';

const EMOJIBASE_URL = 'https://cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/compact.json';
const RECENT_KEY = 'imagemasker.recentEmojis';
const RECENT_COUNT = 24;
// Emojibase groups (meta/groups.json), with the emoji shown on each tab. Group 2 (skin tone and
// hair components) is left out.
const GROUPS = [
  { id: 0, label: 'Smileys & emotion', icon: '😀' },
  { id: 1, label: 'People & body', icon: '👋' },
  { id: 3, label: 'Animals & nature', icon: '🐶' },
  { id: 4, label: 'Food & drink', icon: '🍔' },
  { id: 5, label: 'Travel & places', icon: '✈️' },
  { id: 6, label: 'Activities', icon: '⚽' },
  { id: 7, label: 'Objects', icon: '💡' },
  { id: 8, label: 'Symbols', icon: '❤️' },
  { id: 9, label: 'Flags', icon: '🏁' },
];
const PALETTE_ICONS = { faces: '😀', animals: '🐶', food: '🍔', nature: '🌸', travel: '✈️', objects: '💡', symbols: '❤️' };

let catalog = null;

/** Every Unicode emoji grouped like Emojibase, or null while loading / when it cannot be loaded. */
function loadCatalog() {
  catalog ??= fetch(EMOJIBASE_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`error ${response.status}`);
      return response.json();
    })
    .then((list) =>
      GROUPS.map((group) => ({
        id: `group-${group.id}`,
        label: group.label,
        icon: group.icon,
        items: list
          .filter((entry) => entry.group === group.id && entry.unicode)
          .sort((a, b) => a.order - b.order)
          .map((entry) => ({ emoji: entry.unicode, name: entry.label, words: `${entry.label} ${(entry.tags ?? []).join(' ')}`.toLowerCase() })),
      }))
    )
    .catch(() => {
      catalog = null;
      return null;
    });
  return catalog;
}

function recentEmojis() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');

    return Array.isArray(list) ? list.filter((entry) => typeof entry === 'string' && entry.length <= 40).slice(0, RECENT_COUNT) : [];
  } catch {
    return [];
  }
}

function remember(emoji) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...recentEmojis().filter((entry) => entry !== emoji)].slice(0, RECENT_COUNT)));
  } catch {
    // Not remembered.
  }
}

/** The built-in palette, used until the full list has loaded. */
function paletteSections() {
  return EMOJI_PALETTE.map((group) => ({
    id: `palette-${group.id}`,
    label: group.label,
    icon: PALETTE_ICONS[group.id] ?? group.items[0][0],
    items: group.items.map(([emoji, name]) => ({ emoji, name, words: name.toLowerCase() })),
  }));
}

export class EmojiPicker {
  constructor(app) {
    this.app = app;
    this.options = null;
    this.anchor = null;
    this.search = el('input', { type: 'search', placeholder: 'Search emojis…', 'aria-label': 'Search emojis', className: 'emoji-picker-search' });
    this.tabs = el('div', { className: 'emoji-picker-tabs', role: 'tablist' });
    this.body = el('div', { className: 'emoji-picker-body' });
    this.hint = el('div', { className: 'emoji-picker-hint' });
    this.element = el('div', { className: 'emoji-picker hidden', role: 'dialog', 'aria-label': 'Pick an emoji' }, [
      el('div', { className: 'emoji-picker-head' }, [this.search, iconButton('close', 'Close', () => this.close())]),
      this.tabs,
      this.body,
      this.hint,
    ]);
    this.search.addEventListener('input', () => this.render());
    this.onOutside = (event) => {
      if (!this.element.contains(event.target) && !this.anchor?.contains(event.target)) this.close();
    };
    this.onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    };
    this.place = () => this.position();
    app.root.append(this.element);
  }

  get isOpen() {
    return !this.element.classList.contains('hidden');
  }

  /**
   * Opens under `anchor`. `multiple` keeps it open and toggles emojis (emoji masks); otherwise a
   * pick closes it (stamp tool).
   */
  open(anchor, { style = 0, multiple = false, isActive = () => false, onPick, hint = '' }) {
    if (this.isOpen && this.anchor === anchor) {
      this.close();
      return;
    }

    this.anchor = anchor;
    this.options = { style, multiple, isActive, onPick };
    this.sections = null;
    this.search.value = '';
    this.hint.textContent = hint;
    this.hint.classList.toggle('hidden', !hint);
    this.element.classList.remove('hidden');
    this.render();
    this.position();
    document.addEventListener('pointerdown', this.onOutside, true);
    document.addEventListener('keydown', this.onKey, true);
    window.addEventListener('resize', this.place);

    // On a phone the on-screen keyboard would cover the picker; search is one tap away.
    if (!matchMedia('(pointer: coarse)').matches) this.search.focus({ preventScroll: true });

    void loadCatalog().then((full) => {
      if (full && this.isOpen) {
        this.full = full;
        this.render();
      }
    });
  }

  close() {
    this.element.classList.add('hidden');
    this.anchor = null;
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('resize', this.place);
  }

  /**
   * Under the anchor when there is room, otherwise above it, always inside the window. On a
   * phone it is a sheet along the bottom of the screen.
   */
  position() {
    if (!this.isOpen || !this.anchor) return;

    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    let width;
    let height;
    let left;
    let top;

    if (viewWidth <= 820) {
      width = viewWidth - 16;
      height = Math.min(480, Math.round(viewHeight * 0.62));
      left = 8;
      top = viewHeight - height - 8;
    } else {
      const box = this.anchor.getBoundingClientRect();
      const below = viewHeight - box.bottom - 14;
      const above = box.top - 14;
      const under = below >= 300 || below >= above;

      width = Math.min(340, viewWidth - 16);
      height = Math.max(160, Math.min(420, under ? below : above));
      left = Math.max(8, Math.min(box.left, viewWidth - width - 8));
      top = Math.max(8, Math.min(under ? box.bottom + 6 : box.top - height - 6, viewHeight - height - 8));
    }

    Object.assign(this.element.style, { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px` });
  }

  allSections() {
    const recent = recentEmojis();

    return [
      ...(recent.length ? [{ id: 'recent', label: 'Recently used', icon: '🕘', items: recent.map((emoji) => ({ emoji, name: emoji, words: '' })) }] : []),
      ...(SERVER_EMOJIS.length
        ? [{ id: 'server', label: 'PictureGame server', icon: SERVER_EMOJIS[0], items: SERVER_EMOJIS.map((emoji) => ({ emoji, name: emoji, words: emoji.slice(1, -1).toLowerCase() })) }]
        : []),
      ...(this.full ?? paletteSections()),
    ];
  }

  render() {
    const query = this.search.value.trim().toLowerCase();
    const sections = this.allSections();
    const { style, isActive } = this.options;
    const shown = query
      ? [{
          id: 'results',
          label: 'Results',
          items: sections
            .filter((section) => section.id !== 'recent')
            .flatMap((section) => section.items)
            .filter((item) => query.split(/\s+/).every((word) => item.words.includes(word))),
        }]
      : sections;
    const seen = new Set();

    this.tabs.classList.toggle('hidden', Boolean(query));
    this.tabs.replaceChildren(
      ...sections.map((section) => {
        const tab = el('button', { type: 'button', className: 'emoji-picker-tab', title: section.label, 'aria-label': section.label }, [
          section.id === 'recent' ? document.createTextNode(section.icon) : emojiGlyph(section.icon, style),
        ]);

        tab.addEventListener('click', () => this.body.querySelector(`[data-section="${section.id}"]`)?.scrollIntoView({ block: 'start' }));
        return tab;
      })
    );
    this.body.replaceChildren(
      ...shown.map((section) =>
        el('section', { className: 'emoji-picker-section', 'data-section': section.id }, [
          el('div', { className: 'emoji-picker-title', textContent: section.label }),
          el(
            'div',
            { className: 'emoji-picker-grid' },
            section.items
              .filter((item) => (query ? !seen.has(item.emoji) && seen.add(item.emoji) : true))
              .slice(0, query ? 300 : undefined)
              .map((item) => this.item(item, isActive))
          ),
        ])
      ),
      ...(query && !shown[0].items.length ? [el('div', { className: 'panel-empty-state', textContent: 'No emojis match.' })] : [])
    );
    this.body.scrollTop = 0;
  }

  item({ emoji, name }, isActive) {
    const active = isActive(emoji);
    const control = el('button', { type: 'button', className: `emoji-palette-item${active ? ' is-active' : ''}`, title: name, 'aria-label': name }, [emojiGlyph(emoji, this.options.style)]);

    control.addEventListener('click', () => {
      const { multiple, onPick } = this.options;

      remember(emoji);
      onPick(emoji);

      if (multiple) {
        control.classList.toggle('is-active', Boolean(this.options.isActive(emoji)));
      } else {
        this.close();
      }
    });
    return control;
  }
}
