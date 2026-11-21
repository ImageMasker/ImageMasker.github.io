const { Text } = PIXI;

export class TextTool {
  constructor(canvasEngine, layerManager, eventBus = null) {
    this.canvasEngine = canvasEngine;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.count = 0;
    this.activeEditor = null;
    this.activeTextObject = null;
    this.editorSyncFrameId = 0;

    this.eventBus?.on('viewport:changed', () => {
      this.scheduleEditorPositionSync();
    });

    this.eventBus?.on('canvas:resized', () => {
      this.scheduleEditorPositionSync();
    });
  }

  addText({
    color = '#000000',
    fontSize = 50,
    fontFamily = 'Arial Black',
    fontWeight = '700',
    fontStyle = 'normal',
    stroke = '#000000',
    strokeThickness = 0,
    align = 'center',
    dropShadow = false,
    dropShadowColor = '#000000',
    dropShadowBlur = 4,
    dropShadowDistance = 6,
    blendMode = 'normal',
  } = {}) {
    const layerId = this.layerManager.addLayer(`Text ${++this.count}`, 'text');
    const layer = this.layerManager.getLayer(layerId);
    const text = this.createTextObject({
      text: '2click 2edit',
      color,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      stroke,
      strokeThickness,
      align,
      dropShadow,
      dropShadowColor,
      dropShadowBlur,
      dropShadowDistance,
      blendMode,
    });

    text.position.set(
      this.canvasEngine.canvasWidth / 3,
      this.canvasEngine.canvasHeight / 3
    );

    layer.container.addChild(text);
    this.layerManager.setActiveLayer(layerId);

    return {
      layer,
      object: text,
    };
  }

  createTextObject({
    text,
    color,
    fontSize,
    fontFamily = 'Arial Black',
    fontWeight = '700',
    fontStyle = 'normal',
    stroke = '#000000',
    strokeThickness = 0,
    align = 'center',
    dropShadow = false,
    dropShadowColor = '#000000',
    dropShadowBlur = 4,
    dropShadowDistance = 6,
    blendMode = 'normal',
  }) {
    const textMeta = {
      color,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      stroke,
      strokeThickness,
      align,
      dropShadow,
      dropShadowColor,
      dropShadowBlur,
      dropShadowDistance,
      blendMode,
    };
    const displayText = new Text({
      text,
      style: this.buildStyle(textMeta),
    });

    displayText.anchor?.set(0.5);
    displayText.eventMode = 'static';
    displayText.cursor = 'pointer';
    displayText.blendMode = blendMode;
    displayText.__toolType = 'text';
    displayText.__textData = textMeta;

    return displayText;
  }

  beginEditing(textObject) {
    this.endEditing();
    const previousText = textObject.text;

    const input = document.createElement('textarea');

    input.value = textObject.text;
    input.className = 'text-editor-overlay';
    this.applyEditorStyles(input, textObject);

    const stopPointer = (event) => {
      event.stopPropagation();
    };

    const commit = () => {
      textObject.text = input.value || ' ';
      textObject.__textData = {
        ...textObject.__textData,
        color: textObject.style.fill,
        fontSize: Number(textObject.style.fontSize),
      };
      if (textObject.text !== previousText) {
        this.eventBus?.emit('text:edited', {
          object: textObject,
          beforeText: previousText,
          afterText: textObject.text,
        });
      }
      this.eventBus?.emit('object:changed', {
        object: textObject,
      });
      this.endEditing();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('pointerdown', stopPointer);
    input.addEventListener('mousedown', stopPointer);
    input.addEventListener('click', stopPointer);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        commit();
      }

      if (event.key === 'Escape') {
        this.endEditing();
      }
    });

    document.body.appendChild(input);
    this.activeTextObject = textObject;
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });

    this.activeEditor = input;
  }

  updateTextStyle(textObject, partialMeta) {
    if (!textObject || textObject.__toolType !== 'text') {
      return;
    }

    textObject.__textData = {
      ...textObject.__textData,
      ...partialMeta,
    };
    this.applyTextMeta(textObject, textObject.__textData);
    this.eventBus?.emit('object:changed', {
      object: textObject,
    });
    this.scheduleEditorPositionSync();
  }

  endEditing() {
    if (!this.activeEditor) {
      return;
    }

    window.cancelAnimationFrame(this.editorSyncFrameId);
    this.editorSyncFrameId = 0;
    this.activeEditor.remove();
    this.activeEditor = null;
    this.activeTextObject = null;
  }

  scheduleEditorPositionSync() {
    if (!this.activeEditor || !this.activeTextObject || this.editorSyncFrameId) {
      return;
    }

    this.editorSyncFrameId = window.requestAnimationFrame(() => {
      this.editorSyncFrameId = 0;
      this.syncEditorPosition();
    });
  }

  syncEditorPosition() {
    if (!this.activeEditor || !this.activeTextObject) {
      return;
    }

    this.applyEditorStyles(this.activeEditor, this.activeTextObject);
  }

  applyEditorStyles(input, textObject) {
    const bounds = textObject.getBounds();
    const canvasRect = this.canvasEngine.app.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.canvasEngine.app.renderer.width;
    const scaleY = canvasRect.height / this.canvasEngine.app.renderer.height;

    input.style.left = `${canvasRect.left + bounds.x * scaleX}px`;
    input.style.top = `${canvasRect.top + bounds.y * scaleY}px`;
    input.style.width = `${Math.max(bounds.width * scaleX, 140)}px`;
    input.style.height = `${Math.max(bounds.height * scaleY, 52)}px`;
    input.style.fontFamily = `${textObject.style.fontFamily}, sans-serif`;
    input.style.fontSize = `${Math.max(Number(textObject.style.fontSize) * scaleY, 16)}px`;
    input.style.color = textObject.style.fill;
    input.style.lineHeight = '1.2';
    input.style.fontWeight = textObject.style.fontWeight;
    input.style.fontStyle = textObject.style.fontStyle;
    input.style.textAlign = textObject.style.align;
    input.style.whiteSpace = 'pre-wrap';
    input.style.resize = 'none';
  }

  applyTextMeta(textObject, meta) {
    textObject.style.fontFamily = meta.fontFamily;
    textObject.style.fontSize = meta.fontSize;
    textObject.style.fontWeight = meta.fontWeight;
    textObject.style.fontStyle = meta.fontStyle;
    textObject.style.fill = meta.color;
    textObject.style.stroke = meta.stroke;
    textObject.style.strokeThickness = meta.strokeThickness;
    textObject.style.align = meta.align;
    textObject.blendMode = meta.blendMode ?? 'normal';
    textObject.style.dropShadow = meta.dropShadow
      ? {
          color: meta.dropShadowColor,
          blur: meta.dropShadowBlur,
          distance: meta.dropShadowDistance,
          angle: Math.PI / 4,
          alpha: 0.6,
        }
      : false;
  }

  buildStyle(meta) {
    return {
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
    };
  }
}
