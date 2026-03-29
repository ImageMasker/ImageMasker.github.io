import {
  cloneJson,
  createSceneDocument,
  normalizeSceneDocument,
} from '../document/SceneDocument.js';
import { devAssert } from '../utils/dev.js';

export class SessionSerializer {
  serialize(app) {
    if (!app?.currentBackgroundSource) {
      return null;
    }

    const background = cloneJson(app.currentBackgroundSource);

    return createSceneDocument({
      background,
      viewport: app.canvasEngine.getViewportState(),
      drawing: {
        strokes: cloneJson(app.brushTool.getLayerStrokes(app.layerManager.getDrawingLayer()?.id)),
      },
      layers: app.layerManager
        .getLayers()
        .filter((layer) => layer.type !== 'drawing')
        .map((layer) => this.serializeLayer(app, layer))
        .filter(Boolean),
      ui: {
        uploadedUrl: app.canvasArea.refs.uploadedUrl.value,
        roundTitle: app.canvasArea.refs.roundTitle.value,
        roundAnswer: app.canvasArea.refs.roundAnswer.value,
        subreddit: app.canvasArea.refs.subredditInput.value,
        exportPreset: app.canvasArea.refs.exportPresetSelect.value,
        exportSize: app.canvasArea.refs.exportSizeSelect.value,
        exportFormat: app.canvasArea.refs.exportFormatSelect.value,
        exportQuality: app.canvasArea.refs.exportQualityInput.value,
      },
    });
  }

  serializeLayer(app, layer) {
    const object = layer.container.children[layer.container.children.length - 1];
    const serializedObject = this.serializeObject(layer.type, object);

    if (!serializedObject) {
      return null;
    }

    return {
      name: layer.name,
      type: layer.type,
      visible: layer.visible,
      opacity: layer.opacity ?? 1,
      locked: layer.locked,
      object: serializedObject,
      strokes: cloneJson(app.brushTool.getLayerStrokes(layer.id)),
    };
  }

  serializeObject(type, object) {
    if (!object) {
      return null;
    }

    const base = {
      x: object.x,
      y: object.y,
      scaleX: object.scale.x,
      scaleY: object.scale.y,
      rotation: object.rotation,
      alpha: object.alpha,
      blendMode: object.blendMode ?? 'normal',
    };

    if (type === 'mask') {
      return {
        ...base,
        skewX: object.skew.x,
        skewY: object.skew.y,
        maskMeta: cloneJson(object.__maskMeta ?? {}),
        effects: cloneJson(object.__maskEffectState ?? []),
      };
    }

    if (type === 'shape') {
      return {
        ...base,
        shapeData: cloneJson(object.__shapeData ?? {}),
      };
    }

    if (type === 'effect-region') {
      return {
        ...base,
        regionEffectData: cloneJson(object.__regionEffectData ?? {}),
      };
    }

    if (type === 'text') {
      return {
        ...base,
        text: object.text,
        textData: cloneJson(object.__textData ?? {}),
      };
    }

    if (type === 'image') {
      const persistentUrl = object?.__imageLayerData?.persistentUrl ?? '';

      if (!persistentUrl) {
        return null;
      }

      return {
        ...base,
        imageLayerData: {
          persistentUrl,
          serviceId: object?.__imageLayerData?.serviceId ?? '',
          modelId: object?.__imageLayerData?.modelId ?? '',
          prompt: object?.__imageLayerData?.prompt ?? '',
        },
      };
    }

    return base;
  }

  async restore(app, document) {
    const normalizedDocument = normalizeSceneDocument(document);

    devAssert(Boolean(normalizedDocument), 'Session restore received an invalid scene document.', {
      document,
    });

    if (!normalizedDocument?.background?.url || normalizedDocument.background.type !== 'external') {
      throw new Error('Only URL-backed sessions can be restored automatically.');
    }

    await app.clearEditorScene();
    await app.canvasEngine.loadBackgroundImage(normalizedDocument.background.url, true);
    app.setBackgroundSource({
      type: 'external',
      url: normalizedDocument.background.url,
      visible: normalizedDocument.background.visible !== false,
      opacity: normalizedDocument.background.opacity ?? 1,
    });
    app.applyImageLoadedUiState();

    const ui = normalizedDocument.ui ?? {};
    app.canvasArea.refs.uploadedUrl.value = ui.uploadedUrl ?? '';
    app.canvasArea.refs.roundTitle.value = ui.roundTitle ?? '';
    app.canvasArea.refs.roundAnswer.value = ui.roundAnswer ?? '';
    app.canvasArea.refs.subredditInput.value = ui.subreddit ?? 'picturegame';
    app.canvasArea.refs.exportPresetSelect.value = ui.exportPreset ?? 'original_png';
    app.canvasArea.refs.exportSizeSelect.value = ui.exportSize ?? 'original';
    app.canvasArea.refs.exportFormatSelect.value = ui.exportFormat ?? 'png';
    app.canvasArea.refs.exportQualityInput.value = ui.exportQuality ?? '92';
    app.syncExportControlsFromPreset();
    app.canvasArea.refs.exportSizeSelect.value = ui.exportSize ?? app.canvasArea.refs.exportSizeSelect.value;
    app.canvasArea.refs.exportFormatSelect.value = ui.exportFormat ?? app.canvasArea.refs.exportFormatSelect.value;
    app.canvasArea.refs.exportQualityInput.value = ui.exportQuality ?? app.canvasArea.refs.exportQualityInput.value;
    app.canvasArea.refs.exportQualityValue.textContent = `${app.canvasArea.refs.exportQualityInput.value}%`;
    app.updateExportQualityUi();
    app.applyRestoredSessionUiState();

    const drawingLayerId = app.layerManager.getDrawingLayer()?.id ?? null;

    if (drawingLayerId) {
      app.brushTool.restoreLayerStrokes(
        drawingLayerId,
        cloneJson(normalizedDocument.drawing?.strokes ?? [])
      );
    }

    for (const layer of normalizedDocument.layers ?? []) {
      await this.restoreLayer(app, layer);
    }

    if (normalizedDocument.viewport) {
      app.canvasEngine.setViewportTransform(normalizedDocument.viewport, false);
      app.eventBus.emit('viewport:changed', app.canvasEngine.getViewportState());
    } else {
      app.canvasEngine.resetViewport();
    }

    app.renderLayerPanel();
    app.selectTool.clearSelection();
    app.syncMaskControlsFromState();
  }

  async restoreLayer(app, layerState) {
    if (!layerState?.object) {
      return null;
    }

    if (layerState.type === 'mask') {
      const layer = await app.maskManager.restoreMaskLayer(layerState, app.maskEffects);
      app.layerManager.setLayerOpacity(layer.id, layerState.opacity ?? 1);
      app.brushTool.restoreLayerStrokes(layer.id, cloneJson(layerState.strokes ?? []));
      return layer;
    }

    if (layerState.type === 'shape') {
      const layerId = app.layerManager.addLayer(layerState.name, 'shape');
      const layer = app.layerManager.getLayer(layerId);
      const rect = app.rectTool.createRectangleGraphic(layerState.object.shapeData);

      this.applyObjectState(rect, layerState.object);
      layer.container.addChild(rect);
      layer.visible = layerState.visible !== false;
      layer.locked = layerState.locked === true;
      layer.container.visible = layer.visible;
      app.layerManager.setLayerOpacity(layer.id, layerState.opacity ?? 1);
      app.brushTool.restoreLayerStrokes(layer.id, cloneJson(layerState.strokes ?? []));
      return layer;
    }

    if (layerState.type === 'effect-region') {
      const layerId = app.layerManager.addLayer(layerState.name, 'effect-region');
      const layer = app.layerManager.getLayer(layerId);
      const region = app.regionEffectTool.createRegionObject(layerState.object.regionEffectData);

      this.applyObjectState(region, layerState.object);
      layer.container.addChild(region);
      layer.visible = layerState.visible !== false;
      layer.locked = layerState.locked === true;
      layer.container.visible = layer.visible;
      app.layerManager.setLayerOpacity(layer.id, layerState.opacity ?? 1);
      app.regionEffectTool.refreshRegion(region);
      app.brushTool.restoreLayerStrokes(layer.id, cloneJson(layerState.strokes ?? []));
      return layer;
    }

    if (layerState.type === 'text') {
      const layerId = app.layerManager.addLayer(layerState.name, 'text');
      const layer = app.layerManager.getLayer(layerId);
      const textObject = app.textTool.createTextObject({
        text: layerState.object.text,
        ...layerState.object.textData,
      });

      this.applyObjectState(textObject, layerState.object);
      layer.container.addChild(textObject);
      layer.visible = layerState.visible !== false;
      layer.locked = layerState.locked === true;
      layer.container.visible = layer.visible;
      app.layerManager.setLayerOpacity(layer.id, layerState.opacity ?? 1);
      app.brushTool.restoreLayerStrokes(layer.id, cloneJson(layerState.strokes ?? []));
      return layer;
    }

    if (layerState.type === 'image') {
      const layer = await app.restoreGeneratedImageLayer(layerState);

      if (layer) {
        app.brushTool.restoreLayerStrokes(layer.id, cloneJson(layerState.strokes ?? []));
      }

      return layer;
    }

    devAssert(false, 'Attempted to restore an unsupported layer type.', {
      type: layerState.type,
      layerState,
    });
    return null;
  }

  applyObjectState(object, state) {
    object.position.set(state.x, state.y);
    object.scale.set(state.scaleX, state.scaleY);
    object.rotation = state.rotation;
    object.alpha = state.alpha;
    object.blendMode = state.blendMode ?? 'normal';
  }
}
