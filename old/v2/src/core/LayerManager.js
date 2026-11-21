const { Container } = PIXI;

export class LayerManager {
  constructor(canvasEngine, eventBus) {
    this.canvasEngine = canvasEngine;
    this.eventBus = eventBus;
    this.layers = [];
    this.nextLayerId = 1;
    this.activeLayerId = null;

    this.createDefaultDrawingLayer();
  }

  createDefaultDrawingLayer() {
    const drawingLayerId = this.addLayer('Drawing', 'drawing');
    this.setActiveLayer(drawingLayerId);
  }

  addLayer(name, type) {
    const id = `layer-${this.nextLayerId++}`;
    const container = new Container();
    const layer = {
      id,
      container,
      name,
      type,
      visible: true,
      opacity: 1,
      locked: false,
    };

    this.layers.push(layer);
    this.canvasEngine.layerContainer.addChild(container);
    this.eventBus.emit('layer:added', {
      layer,
      index: this.layers.length - 1,
    });

    return id;
  }

  insertLayer(layer, index = this.layers.length) {
    if (!layer || this.layers.some((existingLayer) => existingLayer.id === layer.id)) {
      return layer;
    }

    const clampedIndex = Math.max(0, Math.min(index, this.layers.length));
    this.layers.splice(clampedIndex, 0, layer);
    this.canvasEngine.layerContainer.addChild(layer.container);
    this.syncLayerOrder();
    this.syncNextLayerId(layer.id);

    this.eventBus.emit('layer:added', {
      layer,
      index: clampedIndex,
      restored: true,
    });

    return layer;
  }

  detachLayer(layerId) {
    const layerIndex = this.layers.findIndex((layer) => layer.id === layerId);

    if (layerIndex === -1) {
      return null;
    }

    const layer = this.layers[layerIndex];

    if (layer.type === 'drawing') {
      return null;
    }

    this.canvasEngine.layerContainer.removeChild(layer.container);
    this.layers.splice(layerIndex, 1);

    if (this.activeLayerId === layerId) {
      this.activeLayerId = this.getDrawingLayer()?.id ?? null;
    }

    this.eventBus.emit('layer:removed', {
      layer,
      index: layerIndex,
      detached: true,
    });

    return {
      layer,
      index: layerIndex,
    };
  }

  removeLayer(layerId) {
    const detached = this.detachLayer(layerId);

    if (!detached) {
      return;
    }

    detached.layer.container.destroy({ children: true });
  }

  getLayerContainer(layerId) {
    return this.getLayer(layerId)?.container ?? null;
  }

  reorderLayer(layerId, newIndex) {
    const currentIndex = this.layers.findIndex((layer) => layer.id === layerId);

    if (currentIndex === -1) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(newIndex, this.layers.length - 1));
    const [layer] = this.layers.splice(currentIndex, 1);
    this.layers.splice(clampedIndex, 0, layer);
    this.syncLayerOrder();

    this.eventBus.emit('layer:reordered', {
      layer,
      fromIndex: currentIndex,
      toIndex: clampedIndex,
    });
  }

  setLayerVisibility(layerId, visible) {
    const layer = this.getLayer(layerId);

    if (!layer) {
      return;
    }

    layer.visible = visible;
    layer.container.visible = visible;
    this.eventBus.emit('layer:updated', {
      layer,
      field: 'visible',
      value: visible,
    });
  }

  setLayerOpacity(layerId, opacity) {
    const layer = this.getLayer(layerId);

    if (!layer) {
      return;
    }

    const clampedOpacity = Math.max(0, Math.min(1, Number(opacity)));
    layer.opacity = clampedOpacity;
    layer.container.alpha = clampedOpacity;
    this.eventBus.emit('layer:updated', {
      layer,
      field: 'opacity',
      value: clampedOpacity,
    });
  }

  setLayerLocked(layerId, locked) {
    const layer = this.getLayer(layerId);

    if (!layer || layer.type === 'drawing') {
      return;
    }

    layer.locked = locked;
    this.eventBus.emit('layer:updated', {
      layer,
      field: 'locked',
      value: locked,
    });
  }

  setLayerName(layerId, name) {
    const layer = this.getLayer(layerId);

    if (!layer) {
      return;
    }

    layer.name = name;
    this.eventBus.emit('layer:updated', {
      layer,
      field: 'name',
      value: name,
    });
  }

  getLayers() {
    return [...this.layers];
  }

  getLayer(layerId) {
    return this.layers.find((layer) => layer.id === layerId) ?? null;
  }

  getActiveLayer() {
    return this.getLayer(this.activeLayerId);
  }

  setActiveLayer(layerId) {
    const layer = this.getLayer(layerId);

    if (!layer) {
      return;
    }

    if (this.activeLayerId === layerId) {
      return;
    }

    this.activeLayerId = layerId;
    this.eventBus.emit('layer:active-changed', {
      layer,
    });
  }

  getDrawingLayer() {
    return this.layers.find((layer) => layer.type === 'drawing') ?? null;
  }

  getLastNonDrawingLayer() {
    return [...this.layers].reverse().find((layer) => layer.type !== 'drawing') ?? null;
  }

  syncLayerOrder() {
    this.layers.forEach((layer, index) => {
      this.canvasEngine.layerContainer.setChildIndex(layer.container, index);
    });
  }

  syncNextLayerId(layerId) {
    const match = /layer-(\d+)/.exec(layerId);

    if (!match) {
      return;
    }

    const numericId = Number(match[1]);
    this.nextLayerId = Math.max(this.nextLayerId, numericId + 1);
  }

  getPrimaryContentObject(layerOrId) {
    const layer = typeof layerOrId === 'string' ? this.getLayer(layerOrId) : layerOrId;

    if (!layer?.container?.children?.length) {
      return null;
    }

    return [...layer.container.children]
      .reverse()
      .find((object) =>
        object?.__toolType !== 'brush-surface' &&
        object?.__toolType !== 'paint-effect-preview' &&
        object?.__toolType !== 'paint-effect-mask'
      ) ?? null;
  }
}
