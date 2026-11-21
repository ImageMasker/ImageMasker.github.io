export class ToolManager {
  constructor(canvasEngine, layerManager, eventBus) {
    this.canvasEngine = canvasEngine;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.tools = new Map();
    this.activeToolName = null;
    this.activePointerId = null;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);

    this.bindEvents();
  }

  bindEvents() {
    const canvas = this.canvasEngine.app.canvas;

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  registerTool(name, toolInstance) {
    this.tools.set(name, toolInstance);
  }

  setActiveTool(name) {
    if (this.activeToolName === name) {
      return;
    }

    const nextTool = this.tools.get(name);

    if (!nextTool) {
      throw new Error(`Tool "${name}" is not registered.`);
    }

    const currentTool = this.getActiveTool();
    currentTool?.deactivate?.();

    this.activeToolName = name;
    nextTool.activate?.();

    this.eventBus.emit('tool:changed', {
      name,
      tool: nextTool,
    });
  }

  getActiveTool() {
    return this.tools.get(this.activeToolName) ?? null;
  }

  getActiveToolName() {
    return this.activeToolName;
  }

  handlePointerDown(event) {
    if (this.canvasEngine.viewportController?.shouldStartPan(event)) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const activeTool = this.getActiveTool();

    if (!activeTool) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.canvasEngine.app.canvas.setPointerCapture?.(event.pointerId);
    activeTool.onPointerDown?.(this.createToolEvent(event));
  }

  handlePointerMove(event) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.getActiveTool()?.onPointerMove?.(this.createToolEvent(event));
  }

  handlePointerUp(event) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.getActiveTool()?.onPointerUp?.(this.createToolEvent(event));

    const canvas = this.canvasEngine.app.canvas;
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    this.activePointerId = null;
  }

  createToolEvent(event) {
    const { x: globalX, y: globalY } = this.canvasEngine.clientToGlobalPoint(
      event.clientX,
      event.clientY
    );
    const canvasPoint = this.canvasEngine.globalToDocumentPoint(globalX, globalY);

    return {
      x: globalX,
      y: globalY,
      canvasX: canvasPoint.x,
      canvasY: canvasPoint.y,
      pointerId: event.pointerId,
      originalEvent: event,
    };
  }
}
