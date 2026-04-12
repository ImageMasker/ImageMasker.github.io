export class ViewportController {
  constructor(canvasEngine, eventBus) {
    this.canvasEngine = canvasEngine;
    this.eventBus = eventBus;
    this.spacePressed = false;
    this.panState = null;
    this.minScale = 0.05;
    this.maxScale = 8;

    this.handleWheel = this.handleWheel.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  init() {
    const canvas = this.canvasEngine.app.canvas;
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.eventBus.on('image:loaded', () => {
      this.fitToScreen();
    });
  }

  shouldStartPan(event) {
    return this.canvasEngine.imgWidth && (
      event.button === 1 ||
      (event.button === 0 && this.spacePressed)
    );
  }

  handlePointerDown(event) {
    if (!this.shouldStartPan(event)) {
      return;
    }

    event.preventDefault();
    const { x, y } = this.getGlobalPointer(event);
    const current = this.canvasEngine.getViewportState();

    this.panState = {
      pointerId: event.pointerId,
      startX: x,
      startY: y,
      originX: current.x,
      originY: current.y,
    };
    this.canvasEngine.app.canvas.style.cursor = 'grab';
  }

  handlePointerMove(event) {
    if (!this.panState || this.panState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const { x, y } = this.getGlobalPointer(event);

    this.canvasEngine.setViewportTransform({
      scale: this.canvasEngine.getViewportState().scale,
      x: this.panState.originX + (x - this.panState.startX),
      y: this.panState.originY + (y - this.panState.startY),
    });
  }

  handlePointerUp(event) {
    if (!this.panState || this.panState.pointerId !== event.pointerId) {
      return;
    }

    this.panState = null;
    this.canvasEngine.app.canvas.style.cursor = 'default';
  }

  handleKeyDown(event) {
    if (event.code === 'Space') {
      this.spacePressed = true;
    }
  }

  handleKeyUp(event) {
    if (event.code === 'Space') {
      this.spacePressed = false;
    }
  }

  handleWheel(event) {
    if (!this.canvasEngine.imgWidth || this.canvasEngine.isPreparedForExport) {
      return;
    }

    event.preventDefault();
    const current = this.canvasEngine.getViewportState().scale;
    const next = event.deltaY < 0 ? current * 1.1 : current / 1.1;
    const { x, y } = this.getGlobalPointer(event);
    this.zoomAt(next, x, y);
  }

  zoomIn() {
    const center = this.getViewportCenter();
    this.zoomAt(this.canvasEngine.getViewportState().scale * 1.15, center.x, center.y);
  }

  zoomOut() {
    const center = this.getViewportCenter();
    this.zoomAt(this.canvasEngine.getViewportState().scale / 1.15, center.x, center.y);
  }

  fitToScreen() {
    const fitScale = Math.min(
      this.canvasEngine.editorWidth / this.canvasEngine.canvasWidth,
      this.canvasEngine.editorHeight / this.canvasEngine.canvasHeight,
      1
    );
    const scale = Math.max(this.minScale, Math.min(this.maxScale, fitScale));
    const documentX = this.canvasEngine.documentContainer?.x ?? 0;
    const documentY = this.canvasEngine.documentContainer?.y ?? 0;

    this.canvasEngine.setViewportTransform({
      scale,
      x: ((this.canvasEngine.editorWidth - this.canvasEngine.canvasWidth * scale) / 2) - documentX * scale,
      y: ((this.canvasEngine.editorHeight - this.canvasEngine.canvasHeight * scale) / 2) - documentY * scale,
    });
  }

  setActualSize() {
    const center = this.getViewportCenter();
    this.zoomAt(this.canvasEngine.getActualSizeScale(), center.x, center.y);
  }

  zoomAt(nextScale, globalX, globalY) {
    const clampedScale = Math.max(this.minScale, Math.min(this.maxScale, nextScale));
    const currentState = this.canvasEngine.getViewportState();
    const anchor = this.canvasEngine.globalToDocumentPoint(globalX, globalY);

    this.canvasEngine.setViewportTransform({
      scale: clampedScale,
      x: currentState.x,
      y: currentState.y,
    }, false);

    const projectedAnchor = this.canvasEngine.documentToGlobalPoint(anchor.x, anchor.y);

    this.canvasEngine.setViewportTransform({
      scale: clampedScale,
      x: currentState.x + (globalX - projectedAnchor.x),
      y: currentState.y + (globalY - projectedAnchor.y),
    });
  }

  getGlobalPointer(event) {
    return this.canvasEngine.clientToGlobalPoint(event.clientX, event.clientY);
  }

  getViewportCenter() {
    return {
      x: this.canvasEngine.app.renderer.width / 2,
      y: this.canvasEngine.app.renderer.height / 2,
    };
  }
}
