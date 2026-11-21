// The canvas, its viewport (zoom / pan) and the render loop. Pointer input is translated to
// document coordinates and forwarded to the active tool.

import { Compositor } from '../gl/Compositor.js';
import { GL } from '../gl/GL.js';

const SCALE_STEPS = [0.125, 0.177, 0.25, 0.354, 0.5, 0.707, 1];
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 16;
const SVG_NS = 'http://www.w3.org/2000/svg';

export class Stage {
  constructor({ host, store, assets, bus }) {
    this.host = host;
    this.store = store;
    this.bus = bus;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'canvas';
    this.overlay = document.createElementNS(SVG_NS, 'svg');
    this.overlay.setAttribute('class', 'stage-overlay');
    this.html = document.createElement('div');
    this.html.className = 'stage-html-overlay';
    host.append(this.canvas, this.overlay, this.html);

    this.glx = new GL(this.canvas);
    this.compositor = new Compositor(this.glx, assets);
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.width = 1;
    this.height = 1;
    this.renderScale = 1;
    this.maxPreview = Math.min(this.glx.maxTextureSize, window.matchMedia?.('(pointer: coarse)')?.matches ? 2048 : 4096);
    this.hidden = new Set();
    this.compare = false;
    this.target = null;
    this.contentDirty = true;
    this.frameRequest = 0;
    this.scaleTimer = 0;
    this.tool = null;
    this.pointers = new Map();
    this.gesture = null;
    this.spaceDown = false;
    this.autoFit = true;

    this.glx.onRestore(() => {
      this.target = null;
      this.invalidate();
    });
    store.on('doc', () => this.invalidate());

    this.bindPointerEvents();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  // ── viewport ──────────────────────────────────────────────────────────────

  get dpr() {
    return Math.min(window.devicePixelRatio || 1, 3);
  }

  resize() {
    const width = Math.max(1, Math.round(this.host.clientWidth));
    const height = Math.max(1, Math.round(this.host.clientHeight));

    if (width === this.width && height === this.height && this.canvas.width === Math.round(width * this.dpr)) {
      return;
    }

    const deltaX = (width - this.width) / 2;
    const deltaY = (height - this.height) / 2;

    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);

    if (this.autoFit) {
      this.fit();
    } else {
      this.setView({ panX: this.view.panX + deltaX, panY: this.view.panY + deltaY });
    }

    this.present();
  }

  fitZoom() {
    const doc = this.store.doc;
    const padding = Math.min(28, this.width * 0.04);

    return Math.max(
      MIN_ZOOM,
      Math.min((this.width - padding * 2) / doc.width, (this.height - padding * 2) / doc.height, 4)
    );
  }

  fit() {
    const doc = this.store.doc;
    const zoom = this.fitZoom();

    this.setView({ zoom, panX: (this.width - doc.width * zoom) / 2, panY: (this.height - doc.height * zoom) / 2 });
    this.autoFit = true;
  }

  setView(patch) {
    Object.assign(this.view, patch);
    this.autoFit = false;
    this.scheduleScaleCheck();
    this.requestFrame();
    this.bus.emit('view', this.view);
  }

  zoomAt(factor, sx = this.width / 2, sy = this.height / 2) {
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.view.zoom * factor));
    const ratio = zoom / this.view.zoom;

    this.setView({ zoom, panX: sx - (sx - this.view.panX) * ratio, panY: sy - (sy - this.view.panY) * ratio });
  }

  setZoom(zoom) {
    this.zoomAt(zoom / this.view.zoom);
  }

  toDoc(sx, sy) {
    return { x: (sx - this.view.panX) / this.view.zoom, y: (sy - this.view.panY) / this.view.zoom };
  }

  toScreen(x, y) {
    return { x: x * this.view.zoom + this.view.panX, y: y * this.view.zoom + this.view.panY };
  }

  // ── rendering ─────────────────────────────────────────────────────────────

  pickScale() {
    const doc = this.store.doc;
    const cap = Math.min(1, this.maxPreview / Math.max(doc.width, doc.height));
    const wanted = this.view.zoom * this.dpr;

    return Math.min(cap, SCALE_STEPS.find((step) => step >= wanted * 0.999) ?? 1);
  }

  scheduleScaleCheck() {
    clearTimeout(this.scaleTimer);
    this.scaleTimer = setTimeout(() => {
      if (this.pickScale() !== this.renderScale) {
        this.invalidate();
      }
    }, 140);
  }

  /** The document (or what is shown of it) changed: re-render on the next frame. */
  invalidate() {
    this.contentDirty = true;
    this.requestFrame();
  }

  requestFrame() {
    if (!this.frameRequest) {
      this.frameRequest = requestAnimationFrame(() => {
        this.frameRequest = 0;
        this.present();
      });
    }
  }

  present() {
    if (this.glx.lost) {
      return;
    }

    const doc = this.store.doc;

    if (!this.store.hasImage) {
      this.releaseTarget();
      this.compositor.present(null, {});
      return;
    }

    if (this.contentDirty || !this.target) {
      const scale = this.pickScale();
      const scaleChanged = scale !== this.renderScale;

      this.releaseTarget();
      this.renderScale = scale;

      try {
        this.target = this.compositor.render(doc, {
          scale,
          hidden: this.hidden.size ? this.hidden : null,
          only: this.compare ? new Set(doc.layers.filter((layer) => layer.type === 'image' && layer.base).map((layer) => layer.id)) : null,
        });
      } catch (error) {
        console.error(error);
        this.bus.emit('render-error', error);
        return;
      }

      this.contentDirty = false;
      this.compositor.prune();

      if (scaleChanged) {
        this.glx.trim(this.target.width, this.target.height);
      }
    }

    const dark = document.documentElement.classList.contains('dark');

    this.compositor.present(this.target, {
      ...this.view,
      dpr: this.dpr,
      docWidth: doc.width,
      docHeight: doc.height,
      checkA: dark ? [0.2, 0.2, 0.24] : [0.82, 0.82, 0.82],
      checkB: dark ? [0.27, 0.27, 0.31] : [0.94, 0.94, 0.94],
    });
  }

  releaseTarget() {
    if (this.target) {
      this.glx.release(this.target);
      this.target = null;
    }
  }

  setCompare(enabled) {
    if (this.compare !== enabled) {
      this.compare = enabled;
      this.invalidate();
    }
  }

  setHidden(id, hidden) {
    if (hidden) {
      this.hidden.add(id);
    } else {
      this.hidden.delete(id);
    }

    this.invalidate();
  }

  /** Full-quality render into a 2D canvas. Falls back to smaller sizes if the GPU runs out of memory. */
  renderToCanvas(doc, { scale = 1, only = null, hidden = null } = {}) {
    const limit = this.glx.maxTextureSize / Math.max(doc.width, doc.height);
    let attempt = Math.min(scale, limit);
    let lastError = null;

    for (let tries = 0; tries < 4; tries += 1) {
      try {
        const canvas = this.compositor.toCanvas(doc, { scale: attempt, only, hidden });

        this.afterOffscreenRender();
        return canvas;
      } catch (error) {
        lastError = error;
        this.glx.trim();
        attempt *= 0.7071;
      }
    }

    throw lastError ?? new Error('Could not render the image.');
  }

  afterOffscreenRender() {
    this.glx.trim(this.target?.width ?? 0, this.target?.height ?? 0);
  }

  // ── input ─────────────────────────────────────────────────────────────────

  setTool(tool) {
    if (this.tool === tool) {
      return;
    }

    this.tool?.deactivate?.();
    this.tool = tool;
    tool?.activate?.();
    this.updateCursor();
  }

  updateCursor(cursor = null) {
    this.canvas.style.cursor = this.gesture?.kind === 'pan' ? 'grabbing' : this.spaceDown ? 'grab' : cursor ?? this.tool?.cursor ?? 'default';
  }

  setSpaceDown(down) {
    this.spaceDown = down;
    this.updateCursor();
  }

  eventFor(event) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const point = this.toDoc(sx, sy);

    return {
      x: point.x,
      y: point.y,
      sx,
      sy,
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey || event.metaKey,
      button: event.button,
      pointerType: event.pointerType,
      original: event,
    };
  }

  bindPointerEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('pointerdown', (event) => {
      if (!this.store.hasImage) {
        return;
      }

      canvas.setPointerCapture?.(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pointers.size === 2) {
        // Second finger: abandon whatever the first one started and pinch instead.
        if (this.gesture?.kind === 'tool') {
          this.tool?.onCancel?.();
        }

        const [a, b] = [...this.pointers.values()];

        this.gesture = { kind: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        return;
      }

      if (this.pointers.size > 2) {
        return;
      }

      if (event.button === 1 || (event.button === 0 && this.spaceDown)) {
        event.preventDefault();
        this.gesture = { kind: 'pan', x: event.clientX, y: event.clientY, panX: this.view.panX, panY: this.view.panY };
        this.updateCursor();
        return;
      }

      if (event.button !== 0) {
        return;
      }

      this.gesture = { kind: 'tool' };
      this.tool?.onDown?.(this.eventFor(event));
    });

    canvas.addEventListener('pointermove', (event) => {
      if (this.pointers.has(event.pointerId)) {
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (this.gesture?.kind === 'pinch' && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const rect = canvas.getBoundingClientRect();
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;

        this.zoomAt(distance / Math.max(1, this.gesture.distance), cx - rect.left, cy - rect.top);
        this.setView({ panX: this.view.panX + cx - this.gesture.cx, panY: this.view.panY + cy - this.gesture.cy });
        Object.assign(this.gesture, { distance, cx, cy });
        return;
      }

      if (this.gesture?.kind === 'pan') {
        this.setView({
          panX: this.gesture.panX + event.clientX - this.gesture.x,
          panY: this.gesture.panY + event.clientY - this.gesture.y,
        });
        return;
      }

      if (this.gesture?.kind === 'tool') {
        const events = event.getCoalescedEvents?.() ?? [];

        for (const coalesced of events.length ? events : [event]) {
          this.tool?.onMove?.(this.eventFor(coalesced));
        }
        return;
      }

      if (this.store.hasImage) {
        this.tool?.onHover?.(this.eventFor(event));
      }
    });

    const finish = (event) => {
      const wasTracked = this.pointers.delete(event.pointerId);
      const gesture = this.gesture;

      if (!wasTracked || !gesture) {
        return;
      }

      if (gesture.kind === 'pinch') {
        if (this.pointers.size < 2) {
          this.gesture = this.pointers.size ? { kind: 'idle' } : null;
        }
        return;
      }

      this.gesture = null;

      if (gesture.kind === 'tool') {
        if (event.type === 'pointercancel') {
          this.tool?.onCancel?.();
        } else {
          this.tool?.onUp?.(this.eventFor(event));
        }
      }

      this.updateCursor();
    };

    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('pointerleave', () => this.tool?.onLeave?.());
    canvas.addEventListener('dblclick', (event) => {
      if (this.store.hasImage) {
        this.tool?.onDoubleClick?.(this.eventFor(event));
      }
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener(
      'wheel',
      (event) => {
        if (!this.store.hasImage) {
          return;
        }

        event.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;

        this.zoomAt(Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015)), event.clientX - rect.left, event.clientY - rect.top);
      },
      { passive: false }
    );
  }
}

/** Creates an SVG element for the stage overlay. */
export function svg(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }

  return element;
}
