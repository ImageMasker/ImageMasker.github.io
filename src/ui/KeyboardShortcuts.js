export class KeyboardShortcuts {
  constructor({
    layerManager,
    historyManager,
    selectTool,
    brushTool,
    eraserTool,
    maskManager,
    brushSizeInput,
    toolManager,
    savedRoundsElement,
    onNavigateSavedRounds,
    onShowCustomSubreddit,
    onDuplicateSelection,
    onDeleteSelection,
    onAdjustObjectOpacity,
    onRedo,
    onAdjustMaskRotation,
    onNudgeSelection,
  }) {
    this.layerManager = layerManager;
    this.historyManager = historyManager;
    this.selectTool = selectTool;
    this.brushTool = brushTool;
    this.eraserTool = eraserTool;
    this.maskManager = maskManager;
    this.brushSizeInput = brushSizeInput;
    this.toolManager = toolManager;
    this.savedRoundsElement = savedRoundsElement;
    this.onNavigateSavedRounds = onNavigateSavedRounds;
    this.onShowCustomSubreddit = onShowCustomSubreddit;
    this.onDuplicateSelection = onDuplicateSelection;
    this.onDeleteSelection = onDeleteSelection;
    this.onAdjustObjectOpacity = onAdjustObjectOpacity;
    this.onRedo = onRedo;
    this.onAdjustMaskRotation = onAdjustMaskRotation;
    this.onNudgeSelection = onNudgeSelection;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(event) {
    const isInputTarget = this.isInputTarget(event.target);

    if (event.ctrlKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.onRedo?.();
      } else {
        this.historyManager.undo();
      }
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.onRedo?.();
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (isInputTarget) {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        this.onNudgeSelection?.(-10, 0);
        return;
      }

      if (this.savedRoundsElement && !this.savedRoundsElement.classList.contains('hidden')) {
        this.onNavigateSavedRounds?.(1);
        return;
      }

      this.onAdjustMaskRotation?.(-2);
      return;
    }

    if (event.key === 'ArrowRight') {
      if (isInputTarget) {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        this.onNudgeSelection?.(10, 0);
        return;
      }

      if (this.savedRoundsElement && !this.savedRoundsElement.classList.contains('hidden')) {
        this.onNavigateSavedRounds?.(2);
        return;
      }

      this.onAdjustMaskRotation?.(2);
      return;
    }

    if (event.key === 'ArrowDown') {
      if (isInputTarget) {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        this.onNudgeSelection?.(0, 10);
        return;
      }

      this.onAdjustObjectOpacity?.(-0.1);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (isInputTarget) {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        this.onNudgeSelection?.(0, -10);
        return;
      }

      this.onAdjustObjectOpacity?.(0.1);
      return;
    }

    if (event.key === '\\') {
      if (isInputTarget) {
        return;
      }

      if (!this.selectTool.getSelectedLayer()) {
        this.selectTool.selectLastSelectableLayer();
      }

      this.toolManager?.setActiveTool('select');
      this.onDuplicateSelection?.();
      return;
    }

    if (event.key === 'Insert') {
      if (isInputTarget) {
        return;
      }

      event.preventDefault();
      this.onShowCustomSubreddit?.();
      return;
    }

    if (event.key.toLowerCase() === 'w' && !isInputTarget) {
      this.adjustBrushSize(5);
      return;
    }

    if (event.key.toLowerCase() === 's' && !isInputTarget) {
      this.adjustBrushSize(-5);
      return;
    }

    if (event.key === 'Delete' && !isInputTarget) {
      this.onDeleteSelection?.();
    }
  }

  isInputTarget(target) {
    const tagName = target?.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
  }

  adjustBrushSize(delta) {
    const nextWidth = Math.max(1, Math.min(50, Number(this.brushSizeInput.value) + delta));
    this.brushSizeInput.value = String(nextWidth);
    this.brushTool.setWidth(nextWidth);
    this.eraserTool.setWidth(nextWidth);
  }
}
