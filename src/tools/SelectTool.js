import {
  applyObjectState,
  objectStatesEqual,
  snapshotObjectState,
} from '../utils/objectState.js';

const { Container, Graphics, Sprite, Text } = PIXI;

export class SelectTool {
  constructor(canvasEngine, layerManager, eventBus, textTool, regionEffectTool) {
    this.canvasEngine = canvasEngine;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.textTool = textTool;
    this.regionEffectTool = regionEffectTool;
    this.overlayContainer = new Container();
    this.overlayContainer.visible = false;
    this.canvasEngine.overlayContainer.addChild(this.overlayContainer);
    this.selectedEntries = [];
    this.selectedLayer = null;
    this.selectedObject = null;
    this.dragState = null;
    this.resizeState = null;
    this.rotateState = null;
    this.handlePoints = [];
    this.handleRadius = this.getHandleRadius();
    this.rotateHandleRadius = this.handleRadius + 2;
    this.overlayFrameId = 0;
    this.lastClickTime = 0;
    this.lastClickObject = null;

    this.eventBus.on('layer:removed', ({ layer }) => {
      if (this.selectedLayer?.id === layer.id) {
        this.clearSelection();
      }
    });

    this.eventBus.on('canvas:resized', () => {
      if (this.selectedObject) {
        this.requestOverlayUpdate();
      }
    });

    this.eventBus.on('viewport:changed', () => {
      if (this.selectedObject) {
        this.requestOverlayUpdate();
      }
    });

    this.eventBus.on('object:changed', ({ object }) => {
      if (this.selectedObject === object) {
        this.requestOverlayUpdate();
      }
    });

    this.eventBus.on('export:start', () => {
      this.overlayContainer.visible = false;
    });

    this.eventBus.on('export:complete', () => {
      if (this.selectedObject) {
        this.requestOverlayUpdate();
      }
    });
  }

  activate() {
    this.canvasEngine.app.canvas.style.cursor = 'default';

    if (this.selectedObject) {
      this.requestOverlayUpdate();
    }
  }

  deactivate() {
    this.dragState = null;
    this.resizeState = null;
    this.rotateState = null;
    window.cancelAnimationFrame(this.overlayFrameId);
    this.overlayFrameId = 0;
    this.overlayContainer.visible = false;
  }

  onPointerDown(event) {
    const handle = this.selectedEntries.length === 1 ? this.findHandleAtPoint(event) : null;

    if (handle && this.selectedObject) {
      this.canvasEngine.app.canvas.style.cursor = handle.cursor;

      if (handle.kind === 'rotate') {
        this.startRotate(event, handle);
      } else {
        this.startResize(event, handle);
      }

      return;
    }

    const hit = this.findHitObject(event);
    const isAppendSelection = Boolean(event.originalEvent.shiftKey);

    if (!hit) {
      if (isAppendSelection) {
        return;
      }

      this.clearSelection();
      return;
    }

    const isAlreadySelected = this.isSelectionMember(hit.layer, hit.object);

    if (isAppendSelection) {
      this.selectLayer(hit.layer, hit.object, {
        append: true,
      });
      return;
    }

    if (!isAlreadySelected || this.selectedEntries.length <= 1) {
      this.selectLayer(hit.layer, hit.object);
    } else {
      this.setSelectionEntries(this.selectedEntries, this.selectedEntries.findIndex((entry) => entry.object === hit.object));
    }

    const isRepeatedTextClick =
      hit.object.__toolType === 'text' &&
      this.lastClickObject === hit.object &&
      Date.now() - this.lastClickTime < 400;

    if (hit.object.__toolType === 'text' && (event.originalEvent.detail >= 2 || isRepeatedTextClick)) {
      this.dragState = null;
      this.resizeState = null;
      this.textTool.beginEditing(hit.object);
      this.lastClickTime = 0;
      this.lastClickObject = null;
      return;
    }

    this.lastClickTime = Date.now();
    this.lastClickObject = hit.object;

    this.dragState = {
      startX: event.canvasX,
      startY: event.canvasY,
      entries: this.selectedEntries.map((entry) => ({
        object: entry.object,
        layer: entry.layer,
        beforeState: snapshotObjectState(entry.object),
        objectX: entry.object.x,
        objectY: entry.object.y,
      })),
    };
    this.canvasEngine.app.canvas.style.cursor = 'grabbing';
  }

  onPointerMove(event) {
    if (this.rotateState && this.selectedObject) {
      this.applyRotation(event);
      this.requestOverlayUpdate();
      return;
    }

    if (this.resizeState && this.selectedObject) {
      this.applyResize(event);
      this.requestOverlayUpdate();
      return;
    }

    if (this.dragState && this.selectedObject) {
      const deltaX = event.canvasX - this.dragState.startX;
      const deltaY = event.canvasY - this.dragState.startY;

      for (const entry of this.dragState.entries) {
        entry.object.position.set(
          entry.objectX + deltaX,
          entry.objectY + deltaY
        );
      }

      this.requestOverlayUpdate();
      return;
    }

    const handle = this.findHandleAtPoint(event);
    if (handle && this.selectedObject) {
      this.canvasEngine.app.canvas.style.cursor = handle.cursor;
      return;
    }

    if (this.findHitObject(event)) {
      this.canvasEngine.app.canvas.style.cursor = 'move';
      return;
    }

    this.canvasEngine.app.canvas.style.cursor = 'default';
  }

  onPointerUp() {
    const transformedObject = this.selectedObject;
    const beforeState =
      this.rotateState?.beforeState ??
      this.resizeState?.beforeState ??
      this.dragState?.entries?.[0]?.beforeState ??
      null;
    const dragEntries = this.dragState?.entries ?? null;

    this.dragState = null;
    this.resizeState = null;
    this.rotateState = null;
    this.canvasEngine.app.canvas.style.cursor = this.selectedObject ? 'move' : 'default';

    if (dragEntries && dragEntries.length > 1) {
      const transformedEntries = dragEntries
        .map((entry) => ({
          object: entry.object,
          beforeState: entry.beforeState,
          afterState: snapshotObjectState(entry.object),
        }))
        .filter((entry) => !objectStatesEqual(entry.beforeState, entry.afterState));

      if (transformedEntries.length > 0) {
        this.eventBus.emit('objects:transformed', {
          entries: transformedEntries,
        });
      }

      return;
    }

    if (!transformedObject || !beforeState) {
      return;
    }

    const afterState = snapshotObjectState(transformedObject);

    if (objectStatesEqual(beforeState, afterState)) {
      return;
    }

    this.eventBus.emit('object:transformed', {
      object: transformedObject,
      beforeState,
      afterState,
      applyState: (state) => {
        applyObjectState(transformedObject, state);
        this.eventBus.emit('object:changed', {
          object: transformedObject,
        });
      },
    });
  }

  selectLayer(layer, object = this.getPrimaryLayerObject(layer), options = {}) {
    if (!layer || layer.locked || layer.visible === false) {
      return;
    }

    const { append = false } = options;

    if (!append) {
      this.setSelectionEntries([{ layer, object }], 0);
      return;
    }

    const existingIndex = this.selectedEntries.findIndex((entry) => entry.layer.id === layer.id && entry.object === object);

    if (existingIndex >= 0) {
      const nextEntries = this.selectedEntries.filter((_, index) => index !== existingIndex);

      if (nextEntries.length === 0) {
        this.clearSelection();
        return;
      }

      this.setSelectionEntries(nextEntries, nextEntries.length - 1);
      return;
    }

    this.setSelectionEntries([...this.selectedEntries, { layer, object }], this.selectedEntries.length);
  }

  selectLastSelectableLayer() {
    const layer = this.layerManager.getLastNonDrawingLayer();

    if (!layer) {
      return null;
    }

    this.selectLayer(layer, this.getPrimaryLayerObject(layer));
    return layer;
  }

  getPrimaryLayerObject(layer) {
    if (!layer?.container?.children?.length) {
      return null;
    }

    return [...layer.container.children]
      .reverse()
      .find((object) => object?.__toolType !== 'brush-surface') ?? null;
  }

  clearSelection() {
    this.selectedEntries = [];
    this.selectedLayer = null;
    this.selectedObject = null;
    this.handlePoints = [];
    window.cancelAnimationFrame(this.overlayFrameId);
    this.overlayFrameId = 0;
    this.overlayContainer.removeChildren().forEach((child) => child.destroy());
    this.overlayContainer.visible = false;
    this.canvasEngine.app.canvas.style.cursor = 'default';
    this.eventBus.emit('selection:changed', {
      layer: null,
      object: null,
      layers: [],
      objects: [],
    });
  }

  duplicateSelection() {
    if (!this.selectedEntries.length) {
      return [];
    }
    const duplicatedEntries = [];

    for (const entry of this.selectedEntries) {
      const clone = this.cloneObject(entry.object);

      if (!clone) {
        continue;
      }

      const layerId = this.layerManager.addLayer(`${entry.layer.name} copy`, entry.layer.type);
      const layer = this.layerManager.getLayer(layerId);

      clone.position.set(entry.object.x + 7, entry.object.y + 7);
      if (clone.__toolType === 'effect-region') {
        this.regionEffectTool?.refreshRegion?.(clone);
      }
      layer.container.addChild(clone);
      duplicatedEntries.push({ layer, object: clone });
    }

    if (duplicatedEntries.length === 0) {
      return [];
    }

    this.setSelectionEntries(duplicatedEntries, duplicatedEntries.length - 1);
    return duplicatedEntries;
  }

  deleteSelection() {
    if (!this.selectedLayer || this.selectedLayer.type === 'drawing') {
      return;
    }

    const layerId = this.selectedLayer.id;
    this.clearSelection();
    this.layerManager.removeLayer(layerId);
  }

  getSelectedObject() {
    return this.selectedObject;
  }

  getSelectedLayer() {
    return this.selectedLayer;
  }

  getSelectedObjects() {
    return this.selectedEntries.map((entry) => entry.object);
  }

  getSelectedLayers() {
    return this.selectedEntries.map((entry) => entry.layer);
  }

  isSelectionMember(layer, object) {
    return this.selectedEntries.some((entry) => entry.layer.id === layer.id && entry.object === object);
  }

  setSelectionEntries(entries, activeIndex = entries.length - 1) {
    const normalizedEntries = entries.filter(Boolean);
    const nextActiveIndex = Math.max(0, Math.min(activeIndex, normalizedEntries.length - 1));
    const activeEntry = normalizedEntries[nextActiveIndex] ?? null;

    this.selectedEntries = normalizedEntries;
    this.selectedLayer = activeEntry?.layer ?? null;
    this.selectedObject = activeEntry?.object ?? null;

    if (this.selectedLayer) {
      this.layerManager.setActiveLayer(this.selectedLayer.id);
    }

    this.requestOverlayUpdate();
    this.eventBus.emit('selection:changed', {
      layer: this.selectedLayer,
      object: this.selectedObject,
      layers: this.getSelectedLayers(),
      objects: this.getSelectedObjects(),
    });
  }

  findHitObject(event) {
    const layers = this.layerManager
      .getLayers()
      .filter((layer) => layer.type !== 'drawing' && layer.visible !== false && layer.locked !== true)
      .slice()
      .reverse();

    for (const layer of layers) {
      const children = [...layer.container.children].reverse();

      for (const object of children) {
        const bounds = object.getBounds();

        if (
          event.x >= bounds.x &&
          event.x <= bounds.x + bounds.width &&
          event.y >= bounds.y &&
          event.y <= bounds.y + bounds.height
        ) {
          return { layer, object };
        }
      }
    }

    return null;
  }

  findHandleAtPoint(event) {
    return this.handlePoints.find((handle) => {
      const radius = handle.kind === 'rotate' ? this.rotateHandleRadius : this.handleRadius;

      return (
        event.x >= handle.x - radius &&
        event.x <= handle.x + radius &&
        event.y >= handle.y - radius &&
        event.y <= handle.y + radius
      );
    }) ?? null;
  }

  startResize(event, handle) {
    const center = this.getObjectVisualCenterGlobal(this.selectedObject);

    this.resizeState = {
      handle,
      beforeState: snapshotObjectState(this.selectedObject),
      centerX: center.x,
      centerY: center.y,
      deltaX: event.x - center.x,
      deltaY: event.y - center.y,
      scaleX: this.selectedObject.scale.x,
      scaleY: this.selectedObject.scale.y,
    };
  }

  startRotate(event, handle) {
    const center = this.getObjectVisualCenterGlobal(this.selectedObject);

    this.rotateState = {
      handle,
      beforeState: snapshotObjectState(this.selectedObject),
      centerX: center.x,
      centerY: center.y,
      startAngle: Math.atan2(event.y - center.y, event.x - center.x),
      objectRotation: this.selectedObject.rotation,
    };
  }

  applyResize(event) {
    const deltaX = event.x - this.resizeState.centerX;
    const deltaY = event.y - this.resizeState.centerY;

    if (this.resizeState.handle.kind === 'corner') {
      const startDistance = Math.hypot(this.resizeState.deltaX, this.resizeState.deltaY);
      const nextDistance = Math.hypot(deltaX, deltaY);
      const ratio = startDistance === 0 ? 1 : nextDistance / startDistance;

      this.selectedObject.scale.set(
        Math.max(this.resizeState.scaleX * ratio, 0.1),
        Math.max(this.resizeState.scaleY * ratio, 0.1)
      );
      this.keepObjectCenteredOnGlobalPoint(
        this.selectedObject,
        this.resizeState.centerX,
        this.resizeState.centerY
      );
      return;
    }

    if (this.resizeState.handle.axis === 'x') {
      const ratio =
        Math.abs(this.resizeState.deltaX) < 1
          ? 1
          : Math.abs(deltaX) / Math.abs(this.resizeState.deltaX);

      this.selectedObject.scale.x = Math.max(this.resizeState.scaleX * ratio, 0.1);
      this.keepObjectCenteredOnGlobalPoint(
        this.selectedObject,
        this.resizeState.centerX,
        this.resizeState.centerY
      );
      return;
    }

    const ratio =
      Math.abs(this.resizeState.deltaY) < 1
        ? 1
        : Math.abs(deltaY) / Math.abs(this.resizeState.deltaY);

    this.selectedObject.scale.y = Math.max(this.resizeState.scaleY * ratio, 0.1);
    this.keepObjectCenteredOnGlobalPoint(
      this.selectedObject,
      this.resizeState.centerX,
      this.resizeState.centerY
    );
  }

  applyRotation(event) {
    const nextAngle = Math.atan2(
      event.y - this.rotateState.centerY,
      event.x - this.rotateState.centerX
    );

    this.selectedObject.rotation =
      this.rotateState.objectRotation + (nextAngle - this.rotateState.startAngle);
    this.keepObjectCenteredOnGlobalPoint(
      this.selectedObject,
      this.rotateState.centerX,
      this.rotateState.centerY
    );
  }

  requestOverlayUpdate() {
    if (this.overlayFrameId) {
      return;
    }

    this.overlayFrameId = window.requestAnimationFrame(() => {
      this.overlayFrameId = 0;
      this.updateOverlay();
    });
  }

  updateOverlay() {
    if (!this.selectedEntries.length || !this.selectedObject) {
      this.clearSelection();
      return;
    }

    this.overlayContainer.removeChildren().forEach((child) => child.destroy());

    const bounds = this.getSelectionBounds();
    const rotateHandleY = bounds.y - 28;
    const rotateHandle = {
      x: bounds.x + bounds.width / 2,
      y: rotateHandleY,
      kind: 'rotate',
      cursor: 'grab',
    };
    const fill = new Graphics();
    fill
      .rect(bounds.x, bounds.y, bounds.width, bounds.height)
      .fill({
        color: 0xffa155,
        alpha: 0.08,
      });

    const border = new Graphics();

    border
      .rect(bounds.x, bounds.y, bounds.width, bounds.height)
      .stroke({
        color: 0xffa155,
        width: 2,
      });

    const labelPrefix = this.selectedEntries.length > 1
      ? `${this.selectedEntries.length} layers`
      : (this.selectedLayer?.name ?? 'Selection');
    const labelText = `${labelPrefix} · ${Math.round(bounds.width)}×${Math.round(bounds.height)}`;
    const label = new Text({
      text: labelText,
      style: {
        fontFamily: 'Arial',
        fontSize: 12,
        fontWeight: '700',
        fill: '#1f1a17',
      },
    });
    const labelX = bounds.x;
    const labelY = Math.max(bounds.y - 24, 4);
    label.position.set(labelX + 8, labelY + 5);

    const labelBackground = new Graphics();
    labelBackground
      .roundRect(labelX, labelY, label.width + 16, label.height + 10, 8)
      .fill({
        color: 0xffd3a1,
        alpha: 0.96,
      })
      .stroke({
        color: 0xffa155,
        width: 1,
      });

    const rotateGuide = new Graphics();
    rotateGuide
      .moveTo(bounds.x + bounds.width / 2, bounds.y)
      .lineTo(rotateHandle.x, rotateHandle.y)
      .stroke({
        color: 0xffa155,
        width: 1,
      });

    this.overlayContainer.addChild(fill);
    this.overlayContainer.addChild(border);
    this.overlayContainer.addChild(rotateGuide);
    this.overlayContainer.addChild(labelBackground);
    this.overlayContainer.addChild(label);
    this.handlePoints = this.selectedEntries.length > 1
      ? []
      : [
          rotateHandle,
          { x: bounds.x, y: bounds.y, kind: 'corner', cursor: 'nwse-resize' },
          {
            x: bounds.x + bounds.width / 2,
            y: bounds.y,
            kind: 'edge',
            axis: 'y',
            cursor: 'ns-resize',
          },
          { x: bounds.x + bounds.width, y: bounds.y, kind: 'corner', cursor: 'nesw-resize' },
          {
            x: bounds.x + bounds.width,
            y: bounds.y + bounds.height / 2,
            kind: 'edge',
            axis: 'x',
            cursor: 'ew-resize',
          },
          {
            x: bounds.x + bounds.width,
            y: bounds.y + bounds.height,
            kind: 'corner',
            cursor: 'nwse-resize',
          },
          {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height,
            kind: 'edge',
            axis: 'y',
            cursor: 'ns-resize',
          },
          {
            x: bounds.x,
            y: bounds.y + bounds.height,
            kind: 'corner',
            cursor: 'nesw-resize',
          },
          {
            x: bounds.x,
            y: bounds.y + bounds.height / 2,
            kind: 'edge',
            axis: 'x',
            cursor: 'ew-resize',
          },
        ];

    for (const point of this.handlePoints) {
      const handle = new Graphics();

      if (point.kind === 'rotate') {
        handle
          .circle(0, 0, this.rotateHandleRadius - 2)
          .fill({ color: 0xfff3dd, alpha: 1 })
          .stroke({ color: 0xffa155, width: 2 });
      } else {
        const size = this.handleRadius * 2 - 4;
        handle.rect(-size / 2, -size / 2, size, size).fill({ color: 0xffa155, alpha: 1 });
      }

      handle.position.set(point.x, point.y);
      this.overlayContainer.addChild(handle);
    }

    this.overlayContainer.visible = true;
  }

  getHandleRadius() {
    const isTouch = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    return isTouch ? 10 : 6;
  }

  getObjectVisualCenterGlobal(object) {
    if (!object) {
      return { x: 0, y: 0 };
    }

    const bounds = object.getLocalBounds();
    const point = object.toGlobal({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    });

    return {
      x: point.x,
      y: point.y,
    };
  }

  keepObjectCenteredOnGlobalPoint(object, targetX, targetY) {
    if (!object?.parent) {
      return;
    }

    const currentCenter = this.getObjectVisualCenterGlobal(object);
    const parentOrigin = object.parent.toLocal({ x: 0, y: 0 });
    const parentTarget = object.parent.toLocal({
      x: targetX - currentCenter.x,
      y: targetY - currentCenter.y,
    });

    object.position.set(
      object.x + (parentTarget.x - parentOrigin.x),
      object.y + (parentTarget.y - parentOrigin.y)
    );
  }

  getSelectionBounds() {
    const boundsList = this.selectedEntries.map((entry) => entry.object.getBounds());
    const minX = Math.min(...boundsList.map((bounds) => bounds.x));
    const minY = Math.min(...boundsList.map((bounds) => bounds.y));
    const maxX = Math.max(...boundsList.map((bounds) => bounds.x + bounds.width));
    const maxY = Math.max(...boundsList.map((bounds) => bounds.y + bounds.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  cloneObject(object) {
    if (object.__toolType === 'mask') {
      const clone = new Sprite(object.texture);

      clone.anchor.set(object.anchor.x, object.anchor.y);
      clone.scale.copyFrom(object.scale);
      clone.skew.copyFrom(object.skew);
      clone.rotation = object.rotation;
      clone.alpha = object.alpha;
      clone.eventMode = 'static';
      clone.cursor = 'pointer';
      clone.filters = object.filters ? [...object.filters] : null;
      clone.blendMode = object.blendMode ?? 'normal';
      clone.__toolType = 'mask';
      clone.__maskMeta = { ...(object.__maskMeta ?? {}) };
      clone.__maskEffectState = JSON.parse(JSON.stringify(object.__maskEffectState ?? []));

      return clone;
    }

    if (object.__toolType === 'image') {
      const clone = new Sprite(object.texture);

      clone.anchor?.set(object.anchor?.x ?? 0, object.anchor?.y ?? 0);
      clone.position.set(object.x, object.y);
      clone.scale.copyFrom(object.scale);
      clone.rotation = object.rotation;
      clone.alpha = object.alpha;
      clone.eventMode = 'static';
      clone.cursor = 'pointer';
      clone.blendMode = object.blendMode ?? 'normal';
      clone.__toolType = 'image';
      clone.__imageLayerData = { ...(object.__imageLayerData ?? {}) };

      return clone;
    }

    if (object.__toolType === 'shape') {
      const clone = new Graphics();
      const meta = object.__shapeData;

      clone
        .rect(-meta.width / 2, -meta.height / 2, meta.width, meta.height)
        .fill({
          color: Number.parseInt(meta.color.replace('#', ''), 16),
          alpha: meta.opacity,
        });

      clone.scale.copyFrom(object.scale);
      clone.rotation = object.rotation;
      clone.alpha = object.alpha;
      clone.blendMode = object.blendMode ?? 'normal';
      clone.eventMode = 'static';
      clone.cursor = 'pointer';
      clone.__toolType = 'shape';
      clone.__shapeData = { ...meta, blendMode: object.blendMode ?? meta.blendMode ?? 'normal' };

      return clone;
    }

    if (object.__toolType === 'effect-region') {
      const clone = this.regionEffectTool?.cloneRegionObject?.(object);

      if (!clone) {
        return null;
      }

      clone.scale.copyFrom(object.scale);
      clone.rotation = object.rotation;
      clone.alpha = object.alpha;
      clone.blendMode = object.blendMode ?? clone.__regionEffectData?.blendMode ?? 'normal';
      return clone;
    }

    if (object.__toolType === 'text') {
      const meta = object.__textData;
      const clone = new Text({
        text: object.text,
        style: {
          fontFamily: meta.fontFamily,
          fontSize: meta.fontSize,
          fontWeight: meta.fontWeight,
          fontStyle: meta.fontStyle,
          fill: meta.color,
          stroke: meta.stroke,
          strokeThickness: meta.strokeThickness,
          align: meta.align,
          dropShadow: meta.dropShadow
            ? {
                color: meta.dropShadowColor,
                blur: meta.dropShadowBlur,
                distance: meta.dropShadowDistance,
                angle: Math.PI / 4,
                alpha: 0.6,
              }
            : false,
        },
      });

      clone.anchor?.set(0.5);
      clone.scale.copyFrom(object.scale);
      clone.rotation = object.rotation;
      clone.alpha = object.alpha;
      clone.blendMode = object.blendMode ?? meta.blendMode ?? 'normal';
      clone.eventMode = 'static';
      clone.cursor = 'pointer';
      clone.__toolType = 'text';
      clone.__textData = { ...meta, blendMode: object.blendMode ?? meta.blendMode ?? 'normal' };

      return clone;
    }

    return null;
  }
}
