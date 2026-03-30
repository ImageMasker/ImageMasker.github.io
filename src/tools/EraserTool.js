import { BrushTool } from './BrushTool.js';

export class EraserTool extends BrushTool {
  constructor(canvasEngine, layerManager, eventBus, options = {}) {
    super(canvasEngine, layerManager, eventBus, {
      ...options,
      strokeType: 'erase',
    });
  }

  canPaintLayer(layer) {
    return Boolean(layer && layer.visible !== false && layer.locked !== true);
  }
}
