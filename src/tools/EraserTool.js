import { BrushTool } from './BrushTool.js';

export class EraserTool extends BrushTool {
  constructor(canvasEngine, layerManager, eventBus, options = {}) {
    super(canvasEngine, layerManager, eventBus, {
      ...options,
      strokeType: 'erase',
    });
  }
}
