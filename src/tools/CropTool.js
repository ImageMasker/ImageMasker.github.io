const { Graphics, Container } = PIXI;

const MIN_CROP_SIZE = 16;

export class CropTool {
  constructor(canvasEngine, eventBus) {
    this.canvasEngine = canvasEngine;
    this.eventBus = eventBus;
    this.overlayContainer = new Container();
    this.overlayContainer.visible = false;
    this.canvasEngine.overlayContainer.addChild(this.overlayContainer);
    this.cropRect = null;
    this.dragState = null;
    this.handleRadius = this.getHandleRadius();
    this.handles = [];

    this.eventBus.on('viewport:changed', () => {
      if (this.overlayContainer.visible) {
        this.renderOverlay();
      }
    });

    this.eventBus.on('canvas:resized', () => {
      if (this.overlayContainer.visible) {
        this.ensureMinimumCropRect();
        this.renderOverlay();
      }
    });
  }

  activate() {
    this.canvasEngine.app.canvas.style.cursor = 'crosshair';

    if (!this.cropRect) {
      this.resetCropRect();
    }

    this.renderOverlay();
  }

  deactivate() {
    this.dragState = null;
    this.overlayContainer.visible = false;
  }

  onPointerDown(event) {
    if (!this.cropRect) {
      this.resetCropRect();
    }

    const handle = this.findHandleAt(event);

    if (handle) {
      this.dragState = {
        kind: 'resize',
        handle,
        startRect: { ...this.cropRect },
      };
      return;
    }

    if (this.pointInRect(event.canvasX, event.canvasY, this.cropRect)) {
      this.dragState = {
        kind: 'move',
        offsetX: event.canvasX - this.cropRect.x,
        offsetY: event.canvasY - this.cropRect.y,
        startRect: { ...this.cropRect },
      };
      return;
    }

    this.dragState = {
      kind: 'draw',
      anchorX: event.canvasX,
      anchorY: event.canvasY,
    };
    this.cropRect = {
      x: event.canvasX,
      y: event.canvasY,
      width: 1,
      height: 1,
    };
    this.renderOverlay();
  }

  onPointerMove(event) {
    if (!this.dragState || !this.cropRect) {
      const handle = this.findHandleAt(event);
      this.canvasEngine.app.canvas.style.cursor = handle?.cursor ?? (this.pointInRect(event.canvasX, event.canvasY, this.cropRect ?? { x: 0, y: 0, width: 0, height: 0 }) ? 'move' : 'crosshair');
      return;
    }

    if (this.dragState.kind === 'move') {
      this.cropRect.x = event.canvasX - this.dragState.offsetX;
      this.cropRect.y = event.canvasY - this.dragState.offsetY;
      this.ensureMinimumCropRect();
      this.renderOverlay();
      return;
    }

    if (this.dragState.kind === 'draw') {
      this.cropRect = this.normalizeRect(
        this.dragState.anchorX,
        this.dragState.anchorY,
        event.canvasX,
        event.canvasY
      );
      this.ensureMinimumCropRect();
      this.renderOverlay();
      return;
    }

    const nextRect = { ...this.dragState.startRect };
    const right = nextRect.x + nextRect.width;
    const bottom = nextRect.y + nextRect.height;

    if (this.dragState.handle.edge.includes('n')) {
      nextRect.y = Math.min(event.canvasY, bottom - MIN_CROP_SIZE);
      nextRect.height = bottom - nextRect.y;
    }

    if (this.dragState.handle.edge.includes('s')) {
      nextRect.height = Math.max(MIN_CROP_SIZE, event.canvasY - nextRect.y);
    }

    if (this.dragState.handle.edge.includes('w')) {
      nextRect.x = Math.min(event.canvasX, right - MIN_CROP_SIZE);
      nextRect.width = right - nextRect.x;
    }

    if (this.dragState.handle.edge.includes('e')) {
      nextRect.width = Math.max(MIN_CROP_SIZE, event.canvasX - nextRect.x);
    }

    this.cropRect = nextRect;
    this.ensureMinimumCropRect();
    this.renderOverlay();
  }

  onPointerUp() {
    this.dragState = null;
  }

  resetCropRect() {
    this.cropRect = {
      x: 0,
      y: 0,
      width: Math.max(MIN_CROP_SIZE, this.canvasEngine.canvasWidth),
      height: Math.max(MIN_CROP_SIZE, this.canvasEngine.canvasHeight),
    };
  }

  getCropRect() {
    if (!this.cropRect) {
      return null;
    }

    return {
      x: Math.round(this.cropRect.x),
      y: Math.round(this.cropRect.y),
      width: Math.max(MIN_CROP_SIZE, Math.round(this.cropRect.width)),
      height: Math.max(MIN_CROP_SIZE, Math.round(this.cropRect.height)),
    };
  }

  renderOverlay() {
    if (!this.cropRect) {
      this.overlayContainer.visible = false;
      return;
    }

    this.overlayContainer.removeChildren().forEach((child) => child.destroy());

    const rect = this.cropRect;
    const topLeft = this.canvasEngine.documentToGlobalPoint(rect.x, rect.y);
    const bottomRight = this.canvasEngine.documentToGlobalPoint(rect.x + rect.width, rect.y + rect.height);
    const globalRect = {
      x: topLeft.x,
      y: topLeft.y,
      width: Math.max(1, bottomRight.x - topLeft.x),
      height: Math.max(1, bottomRight.y - topLeft.y),
    };
    const screen = new Graphics();

    screen
      .rect(0, 0, this.canvasEngine.app.renderer.width, this.canvasEngine.app.renderer.height)
      .fill({ color: 0x111111, alpha: 0.45 });
    screen
      .rect(globalRect.x, globalRect.y, globalRect.width, globalRect.height)
      .cut();

    const border = new Graphics();
    border.rect(globalRect.x, globalRect.y, globalRect.width, globalRect.height).stroke({
      color: 0xffa155,
      width: 2,
    });

    this.overlayContainer.addChild(screen);
    this.overlayContainer.addChild(border);
    this.handles = this.buildHandles(rect);

    for (const handle of this.handles) {
      const globalPoint = this.canvasEngine.documentToGlobalPoint(handle.x, handle.y);
      const graphic = new Graphics();
      const size = this.handleRadius * 2;
      graphic.rect(-size / 2, -size / 2, size, size).fill({ color: 0xffa155, alpha: 1 });
      graphic.position.set(globalPoint.x, globalPoint.y);
      this.overlayContainer.addChild(graphic);
    }

    this.overlayContainer.visible = true;
  }

  buildHandles(rect) {
    return [
      { x: rect.x, y: rect.y, edge: 'nw', cursor: 'nwse-resize' },
      { x: rect.x + rect.width / 2, y: rect.y, edge: 'n', cursor: 'ns-resize' },
      { x: rect.x + rect.width, y: rect.y, edge: 'ne', cursor: 'nesw-resize' },
      { x: rect.x + rect.width, y: rect.y + rect.height / 2, edge: 'e', cursor: 'ew-resize' },
      { x: rect.x + rect.width, y: rect.y + rect.height, edge: 'se', cursor: 'nwse-resize' },
      { x: rect.x + rect.width / 2, y: rect.y + rect.height, edge: 's', cursor: 'ns-resize' },
      { x: rect.x, y: rect.y + rect.height, edge: 'sw', cursor: 'nesw-resize' },
      { x: rect.x, y: rect.y + rect.height / 2, edge: 'w', cursor: 'ew-resize' },
    ];
  }

  findHandleAt(event) {
    return this.handles.find((handle) =>
      Math.abs(event.canvasX - handle.x) <= this.handleRadius &&
      Math.abs(event.canvasY - handle.y) <= this.handleRadius
    ) ?? null;
  }

  pointInRect(x, y, rect) {
    return rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  normalizeRect(x1, y1, x2, y2) {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.max(MIN_CROP_SIZE, Math.abs(x2 - x1)),
      height: Math.max(MIN_CROP_SIZE, Math.abs(y2 - y1)),
    };
  }

  ensureMinimumCropRect() {
    if (!this.cropRect) {
      return;
    }

    this.cropRect.width = Math.max(MIN_CROP_SIZE, this.cropRect.width);
    this.cropRect.height = Math.max(MIN_CROP_SIZE, this.cropRect.height);
  }

  getHandleRadius() {
    const isTouch = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    return isTouch ? 10 : 6;
  }
}
