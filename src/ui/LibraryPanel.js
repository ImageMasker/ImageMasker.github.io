// The mask library: effect masks, overlay masks (procedural + classic images), emoji masks and
// flags ("Other"), and the user's own and community masks (CustomMasksPanel). Effect and pattern
// thumbnails are rendered live from the loaded picture.
//
// To keep the first load light, a thumbnail is only rendered once its tile is on screen (each
// needs its own shader compiled), a few milliseconds' worth per frame, and the "Other" tab's
// emoji tiles (and their artwork downloads) are only made the first time that tab is opened.

import { EFFECT_CATEGORIES, EFFECTS, defaultParams } from '../gl/effects.js';
import { PATTERNS } from '../gl/patterns.js';
import { EMOJI_SETS, randomEmojis } from '../masks/emojiData.js';
import { PRESET_MASKS } from '../masks/maskData.js';
import { emojiPreview } from '../raster/emoji.js';
import { loadEmojiArt } from '../raster/emojiArt.js';
import { el } from '../utils/dom.js';
import { createSampleScene } from '../utils/sampleScene.js';
import { CustomMasksPanel } from './CustomMasksPanel.js';
import { icon } from './kit.js';

const TABS = [
  { id: 'effects', label: 'Effects' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'other', label: 'Other' },
  { id: 'custom', label: 'Custom' },
];
const THUMB_WIDTH = 176;
// Milliseconds of thumbnail rendering per frame, so scrolling and typing stay smooth.
const THUMB_BUDGET = 6;
// A transparent pixel for previews that are not drawn yet.
const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const STRENGTH_LABEL = ['', 'Light scramble', 'Medium scramble', 'Heavy scramble'];

export class LibraryPanel {
  constructor(app) {
    this.app = app;
    this.tab = 'effects';
    this.thumbs = [];
    this.thumbTimer = 0;
    this.thumbFrame = 0;
    this.thumbSourceTarget = null;
    this.thumbByCanvas = new WeakMap();
    this.thumbObserver = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => this.thumbsSeen(entries), { rootMargin: '200px' })
      : null;
    this.emojiBuilt = false;
    this.flagsLoaded = false;
    this.panels = {};
    this.tabButtons = {};
    this.element = this.render();
    this.setTab('effects');

    app.bus.on('image-changed', () => this.scheduleThumbs(250));
    app.stage.glx.onRestore(() => {
      this.thumbSourceTarget = null;
      this.refreshThumbs();
    });

    const syncTarget = () => this.syncCollageBar();

    app.bus.on('collage-target', syncTarget);
    app.bus.on('image-changed', syncTarget);
    app.store.on('doc', syncTarget);
    syncTarget();
  }

  /** On a collage: which picture new masks go to. */
  syncCollageBar() {
    const cells = this.app.collageCells?.();
    const bar = this.collageBar;
    const count = cells?.length ?? 0;

    bar.classList.toggle('hidden', !count);

    if (!count) {
      return;
    }

    if (this.collageSelect.options.length !== count + 1) {
      this.collageSelect.replaceChildren(
        el('option', { value: 'all', textContent: 'Whole collage' }),
        ...cells.map((_, index) => el('option', { value: String(index), textContent: `Picture ${index + 1}` }))
      );
    }

    const target = this.app.activeCollageTarget();

    this.collageSelect.value = target === null ? 'all' : String(target);
  }

  render() {
    const tabs = el(
      'div',
      { className: 'tab-strip', role: 'tablist' },
      TABS.map((tab) => {
        const tabButton = el('button', { type: 'button', className: 'tab-button', textContent: tab.label, role: 'tab' });

        tabButton.addEventListener('click', () => this.setTab(tab.id));
        this.tabButtons[tab.id] = tabButton;
        return tabButton;
      })
    );

    this.panels.effects = this.renderEffects();
    this.panels.overlays = this.renderOverlays();
    this.panels.other = this.renderOther();
    this.panels.custom = this.renderCustom();

    this.collageSelect = el('select', { 'aria-label': 'Add masks to' });
    this.collageSelect.addEventListener('change', () => {
      const value = this.collageSelect.value;

      this.app.setCollageTarget(value === 'all' ? null : Number(value), { quiet: true });
    });
    this.collageBar = el('label', { className: 'field field--inline library-collage-bar hidden', title: 'On a collage, masks you pick go on this picture only' }, [
      el('span', { className: 'field-label', textContent: 'Add to' }),
      this.collageSelect,
    ]);

    return el('fieldset', { id: 'masks', className: 'panel-fieldset library-panel' }, [
      el('legend', { textContent: 'Masks' }),
      this.collageBar,
      tabs,
      el('div', { className: 'library-scroll' }, Object.values(this.panels)),
    ]);
  }

  setTab(id) {
    this.tab = id;

    for (const tab of TABS) {
      this.tabButtons[tab.id].classList.toggle('is-active', tab.id === id);
      this.tabButtons[tab.id].setAttribute('aria-selected', tab.id === id ? 'true' : 'false');
      this.panels[tab.id].classList.toggle('hidden', tab.id !== id);
    }

    if (id === 'other') {
      if (!this.emojiBuilt) {
        this.emojiBuilt = true;
        this.emojiGrid.replaceChildren(...this.emojiTiles());
      }

      this.loadFlags();
    }

    if (id === 'custom') {
      this.custom.shown();
    }
  }

  /** A gallery tile. `render(source)` returns ImageData for live thumbnails. */
  tile({ label, title = '', strength = 0, image = '', render = null, onPick, badge = null, menu = null, star = null }) {
    const preview = render
      ? el('canvas', { className: 'mask-tile-preview', width: '8', height: '8' })
      : el('img', { className: 'mask-tile-preview', src: image, alt: '', loading: 'lazy' });
    const add = el('span', { className: 'mask-tile-add', title: 'Add as a new layer', role: 'button', 'aria-label': `Stack ${label}` }, [icon('plus')]);
    const starToggle = star
      ? el('span', {
          className: `mask-tile-star${star.on ? ' is-on' : ''}`,
          role: 'button',
          title: star.on ? 'Starred: shown first. Click to unstar.' : 'Star it to keep it at the top',
          'aria-label': star.on ? `Unstar ${label}` : `Star ${label}`,
          'aria-pressed': star.on ? 'true' : 'false',
          textContent: '★',
        })
      : null;
    const tileButton = el('button', { type: 'button', className: 'mask-tile', title: `${title || label}\nClick to try it (replaces the selected mask), Shift+click or + to stack.` }, [
      // The star sits on the picture's corner, so it needs a box of its own.
      starToggle ? el('span', { className: 'mask-tile-media' }, [preview, starToggle]) : preview,
      el('span', { className: 'mask-tile-label' }, [
        el('span', { className: 'mask-tile-name', textContent: label }),
        ...(strength
          ? [el('span', { className: `mask-tile-strength strength-${strength}`, title: STRENGTH_LABEL[strength], 'aria-label': STRENGTH_LABEL[strength] })]
          : []),
      ]),
      add,
      ...(badge ? [el('span', { className: `mask-tile-badge mask-tile-badge--${badge.kind}`, title: badge.title, textContent: badge.text })] : []),
    ]);
    const more = menu
      ? el('span', { className: 'mask-tile-more', title: 'More options', role: 'button', 'aria-label': `Options for ${label}`, textContent: '⋯' })
      : null;

    if (more) {
      tileButton.append(more);
      tileButton.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.app.contextMenu.open(event.clientX, event.clientY, menu());
      });
    }

    tileButton.addEventListener('click', (event) => {
      if (starToggle?.contains(event.target)) {
        star.toggle();
        return;
      }

      if (more?.contains(event.target)) {
        const box = more.getBoundingClientRect();

        this.app.contextMenu.open(box.left, box.bottom + 4, menu());
        return;
      }

      onPick({ stack: event.shiftKey || add.contains(event.target) });
    });

    if (render) {
      const thumb = { canvas: preview, render, dirty: true, seen: !this.thumbObserver };

      this.thumbs.push(thumb);
      this.thumbByCanvas.set(preview, thumb);
      this.thumbObserver?.observe(preview);
    }

    return tileButton;
  }

  renderEffects() {
    const groups = EFFECT_CATEGORIES.map((category) =>
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: category.label }),
        el(
          'div',
          { className: 'mask-grid' },
          EFFECTS.filter((effect) => effect.cat === category.id && !effect.hidden).map((effect) =>
            this.tile({
              label: effect.name,
              title: effect.desc,
              strength: effect.strength,
              render: (source) =>
                this.app.stage.compositor.effectPreview(effect, { ...defaultParams(effect), ...(effect.thumb ?? {}) }, 12.5, source),
              onPick: (options) => this.app.addEffect(effect.id, options),
            })
          )
        ),
      ])
    );

    return el('div', { className: 'library-tab' }, [
      ...groups,
    ]);
  }

  renderOverlays() {
    return el('div', { className: 'library-tab hidden' }, [
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: 'Classic' }),
        el(
          'div',
          { className: 'mask-grid' },
          PRESET_MASKS.map((preset) =>
            this.tile({
              label: preset.name,
              image: preset.thumb,
              onPick: (options) => this.app.addPresetMask(preset, options),
            })
          )
        ),
      ]),
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: 'Patterns' }),
        el(
          'div',
          { className: 'mask-grid' },
          PATTERNS.filter((pattern) => !pattern.hidden).map((pattern) =>
            this.tile({
              label: pattern.name,
              render: (source) => this.app.stage.compositor.patternPreview(pattern, defaultParams(pattern), 12.5, source),
              onPick: (options) => this.app.addPattern(pattern.id, options),
            })
          )
        ),
      ]),
    ]);
  }

  renderOther() {
    this.flagSearch = el('input', { type: 'search', placeholder: 'Search flags…', 'aria-label': 'Search flag masks', className: 'library-search' });
    this.flagGrid = el('div', { className: 'mask-grid mask-grid--flags' });
    this.flagStatus = el('div', { className: 'panel-empty-state', textContent: 'Loading flags…' });
    this.flagSearch.addEventListener('input', () => this.renderFlagGrid());

    return el('div', { className: 'library-tab hidden' }, [
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: 'Emoji' }),
        (this.emojiGrid = el('div', { className: 'mask-grid' })),
      ]),
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: 'Flags' }),
        this.flagSearch,
        this.flagStatus,
        this.flagGrid,
      ]),
    ]);
  }

  /** "From the picture", "Random" and the ready-made emoji sets. */
  emojiTiles() {
    const app = this.app;
    // Previews wait for the emoji artwork and are drawn one per frame: drawing emojis with the
    // device's font is slow the first time (tens of milliseconds a tile), the artwork is not. If
    // the artwork cannot load, loadEmojiArt gives up after a while and the font is used after all.
    const waiting = [];
    let frame = 0;
    const drawNext = () => {
      frame = 0;
      waiting.shift()?.();

      if (waiting.length) {
        frame = requestAnimationFrame(drawNext);
      }
    };
    const preview = (emojis, seed, style = 0) => {
      void loadEmojiArt(emojis.map((emoji) => [emoji, style])).then(() => {
        waiting.push(() => {
          const image = tiles.get(seed)?.querySelector('.mask-tile-preview');

          if (image) image.src = emojiPreview(emojis, { seed, style }).toDataURL();
        });
        frame ||= requestAnimationFrame(drawNext);
      });
      return BLANK_IMAGE;
    };
    const tiles = new Map();
    const fromPicture = this.tile({
      label: 'From the picture',
      title: 'A small model in your browser looks at the picture and picks emojis for what it sees (downloads about 23 MB the first time). Careful: they can hint at the answer.',
      image: preview(['✨', '🔍', '🖼️'], 3),
      onPick: (options) => app.emojiTools.addFromPicture(options),
    });
    const fromPictureName = fromPicture.querySelector('.mask-tile-name');

    tiles.set(3, fromPicture);

    app.bus.on('emoji-status', (status) => {
      fromPictureName.textContent = status.busy ? `${status.label}…` : 'From the picture';
    });

    return [
      fromPicture,
      ...EMOJI_SETS.map((set, index) => {
        const tile = this.tile({
          label: set.name,
          title: set.emojis ? `${set.emojis.join(' ')}
Pick your own emojis, density and size in the mask's properties.` : 'Different emojis every time',
          image: preview(set.emojis ?? set.preview ?? ['🎲', '❓', '✨', '🎁'], index + 11, set.style),
          onPick: (options) => app.addEmojiMask(set.emojis ?? (set.random ?? randomEmojis)(), { ...options, style: set.style }),
        });

        tiles.set(index + 11, tile);
        return tile;
      }),
    ];
  }

  async loadFlags() {
    if (this.flagsLoaded) {
      return;
    }

    this.flagsLoaded = true;

    try {
      this.flags = (await this.app.flagCatalog()).flags;
      this.renderFlagGrid();
    } catch (error) {
      this.flagsLoaded = false;
      this.flagStatus.textContent = 'Could not load the flag masks.';
    }
  }

  renderFlagGrid() {
    const query = this.flagSearch.value.trim().toLowerCase();
    const flags = (this.flags ?? []).filter((flag) => flag.name.toLowerCase().includes(query));

    this.flagStatus.classList.toggle('hidden', flags.length > 0);
    this.flagStatus.textContent = 'No flags found.';
    this.flagGrid.replaceChildren(
      ...flags.map((flag) =>
        this.tile({
          label: flag.name,
          image: flag.motif?.src || flag.full?.src || '',
          onPick: (options) => this.app.addFlagMask(flag, options),
        })
      )
    );
  }

  renderCustom() {
    this.custom = new CustomMasksPanel(this.app, this);
    return this.custom.element;
  }

  // ── live thumbnails ───────────────────────────────────────────────────────

  scheduleThumbs(delay = 0) {
    clearTimeout(this.thumbTimer);
    this.thumbTimer = setTimeout(() => this.refreshThumbs(), delay);
  }

  /** Small render of the picture without any masks; falls back to a sample scene. */
  thumbSource() {
    const { store, stage } = this.app;
    const compositor = stage.compositor;

    if (store.hasImage) {
      const doc = store.doc;
      const images = doc.layers.filter((layer) => layer.type === 'image' && layer.visible);

      if (images.length) {
        return compositor.render(doc, {
          scale: THUMB_WIDTH / Math.max(doc.width, doc.height),
          only: new Set(images.map((layer) => layer.id)),
        });
      }
    }

    const sample = createSampleScene(THUMB_WIDTH, Math.round(THUMB_WIDTH * 0.72));

    return compositor.targetFromSource(sample, sample.width, sample.height);
  }

  /** The picture changed: every thumbnail is out of date, and the ones on screen are redrawn. */
  refreshThumbs() {
    if (this.thumbSourceTarget) {
      this.app.stage.glx.release(this.thumbSourceTarget);
      this.thumbSourceTarget = null;
    }

    for (const thumb of this.thumbs) {
      thumb.dirty = true;
    }

    this.queueThumbs();
  }

  thumbsSeen(entries) {
    for (const entry of entries) {
      const thumb = this.thumbByCanvas.get(entry.target);

      if (thumb) {
        thumb.seen = entry.isIntersecting;
      }
    }

    this.queueThumbs();
  }

  queueThumbs() {
    if (!this.thumbFrame && this.thumbs.some((thumb) => thumb.dirty && thumb.seen)) {
      this.thumbFrame = requestAnimationFrame(() => this.drawThumbs());
    }
  }

  /** Draws out-of-date thumbnails that are on screen, for a few milliseconds, then waits a frame. */
  drawThumbs() {
    const { stage } = this.app;
    const started = performance.now();

    this.thumbFrame = 0;

    if (stage.glx.lost) {
      return;
    }

    try {
      this.thumbSourceTarget ??= this.thumbSource();
    } catch (error) {
      console.error(error);
      return;
    }

    let drew = false;

    for (const thumb of this.thumbs) {
      if (!thumb.dirty || !thumb.seen) {
        continue;
      }

      if (drew && performance.now() - started > THUMB_BUDGET) {
        break;
      }

      thumb.dirty = false;
      drew = true;

      try {
        const image = thumb.render(this.thumbSourceTarget);

        thumb.canvas.width = image.width;
        thumb.canvas.height = image.height;
        thumb.canvas.getContext('2d').putImageData(image, 0, 0);
      } catch (error) {
        console.error(error);
      }
    }

    if (drew) {
      stage.afterOffscreenRender();
    }

    this.queueThumbs();
  }
}
