export const SHORTCUT_COMMANDS = [
  { id: 'undo', label: 'Undo', category: 'Edit', defaultBinding: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', category: 'Edit', defaultBinding: 'Ctrl+Y' },
  { id: 'copyCanvas', label: 'Copy canvas to clipboard', category: 'Export', defaultBinding: 'Ctrl+C' },
  { id: 'duplicate', label: 'Duplicate', category: 'Edit', defaultBinding: 'D' },
  { id: 'delete', label: 'Delete selection', category: 'Edit', defaultBinding: 'Delete' },
  { id: 'brush', label: 'Brush mode', category: 'Tools', defaultBinding: 'B' },
  { id: 'eraser', label: 'Eraser', category: 'Tools', defaultBinding: 'E' },
  { id: 'move', label: 'Move mode', category: 'Tools', defaultBinding: 'V' },
  { id: 'blurBrush', label: 'Blur brush', category: 'Tools', defaultBinding: 'G' },
  { id: 'pixelBrush', label: 'Pixel brush', category: 'Tools', defaultBinding: 'X' },
  { id: 'crop', label: 'Crop / Resize', category: 'Tools', defaultBinding: 'C' },
  { id: 'addRectangle', label: 'Add rectangle', category: 'Insert', defaultBinding: 'R' },
  { id: 'addText', label: 'Add text', category: 'Insert', defaultBinding: 'T' },
  { id: 'addRegion', label: 'Add region', category: 'Insert', defaultBinding: 'A' },
  { id: 'brushSizeUp', label: 'Increase brush size', category: 'Canvas', defaultBinding: 'W' },
  { id: 'brushSizeDown', label: 'Decrease brush size', category: 'Canvas', defaultBinding: 'S' },
  { id: 'stepLeft', label: 'Left action', category: 'Canvas', defaultBinding: 'ArrowLeft' },
  { id: 'stepRight', label: 'Right action', category: 'Canvas', defaultBinding: 'ArrowRight' },
  { id: 'opacityDown', label: 'Selection opacity down', category: 'Canvas', defaultBinding: 'ArrowDown' },
  { id: 'opacityUp', label: 'Selection opacity up', category: 'Canvas', defaultBinding: 'ArrowUp' },
  { id: 'nudgeLeft', label: 'Nudge left', category: 'Canvas', defaultBinding: 'Shift+ArrowLeft' },
  { id: 'nudgeRight', label: 'Nudge right', category: 'Canvas', defaultBinding: 'Shift+ArrowRight' },
  { id: 'nudgeDown', label: 'Nudge down', category: 'Canvas', defaultBinding: 'Shift+ArrowDown' },
  { id: 'nudgeUp', label: 'Nudge up', category: 'Canvas', defaultBinding: 'Shift+ArrowUp' },
  { id: 'customSubreddit', label: 'Show custom subreddit', category: 'Panels', defaultBinding: 'Insert' },
];

const COMMAND_MAP = new Map(SHORTCUT_COMMANDS.map((command) => [command.id, command]));

export function getDefaultShortcutBindings() {
  return Object.fromEntries(
    SHORTCUT_COMMANDS.map((command) => [command.id, command.defaultBinding])
  );
}

export class KeyboardShortcuts {
  constructor({
    settings,
    historyManager,
    selectTool,
    savedRoundsElement,
    getBindings = null,
    shouldIgnoreShortcut = null,
    handlers = {},
  }) {
    this.settings = settings;
    this.historyManager = historyManager;
    this.selectTool = selectTool;
    this.savedRoundsElement = savedRoundsElement;
    this.shouldIgnoreShortcut = shouldIgnoreShortcut;
    this.handlers = handlers;
    this.bindings = this.normalizeBindings(getBindings?.() ?? this.settings?.getEditorShortcuts?.() ?? {});
    this.bindingToCommand = new Map();
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.rebuildIndex();
  }

  init() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  getCommands() {
    return SHORTCUT_COMMANDS.map((command) => ({
      ...command,
      binding: this.getBinding(command.id),
    }));
  }

  getBinding(commandId) {
    return this.bindings[commandId] ?? COMMAND_MAP.get(commandId)?.defaultBinding ?? '';
  }

  setBinding(commandId, binding) {
    const normalizedBinding = this.normalizeBindingString(binding);

    if (!COMMAND_MAP.has(commandId)) {
      return { ok: false, message: 'Unknown command.' };
    }

    if (!normalizedBinding) {
      return { ok: false, message: 'Shortcut cannot be empty.' };
    }

    const conflictingCommand = [...this.bindingToCommand.entries()]
      .find(([existingBinding, existingCommandId]) =>
        existingBinding === normalizedBinding && existingCommandId !== commandId
      )?.[1];

    if (conflictingCommand) {
      return {
        ok: false,
        message: `"${COMMAND_MAP.get(conflictingCommand)?.label ?? conflictingCommand}" already uses ${normalizedBinding}.`,
      };
    }

    this.bindings[commandId] = normalizedBinding;
    this.persist();
    this.rebuildIndex();
    return { ok: true, message: 'Shortcut updated.' };
  }

  resetBinding(commandId) {
    if (!COMMAND_MAP.has(commandId)) {
      return;
    }

    this.bindings[commandId] = COMMAND_MAP.get(commandId).defaultBinding;
    this.persist();
    this.rebuildIndex();
  }

  resetAllBindings() {
    this.bindings = getDefaultShortcutBindings();
    this.persist();
    this.rebuildIndex();
  }

  formatBinding(binding) {
    return binding || 'Unassigned';
  }

  eventToBinding(event) {
    const parts = [];

    if (event.ctrlKey) {
      parts.push('Ctrl');
    }

    if (event.altKey) {
      parts.push('Alt');
    }

    if (event.shiftKey) {
      parts.push('Shift');
    }

    if (event.metaKey) {
      parts.push('Meta');
    }

    const key = this.normalizeKey(event.key);

    if (!key || ['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      return '';
    }

    parts.push(key);
    return parts.join('+');
  }

  handleKeyDown(event) {
    if (this.shouldIgnoreShortcut?.(event) === true) {
      return;
    }

    const binding = this.eventToBinding(event);
    const commandId = this.bindingToCommand.get(binding);

    if (!commandId) {
      return;
    }

    if (this.isInputTarget(event.target)) {
      return;
    }

    const handler = this.handlers[commandId];

    if (!handler) {
      return;
    }

    event.preventDefault();
    handler(event);
  }

  isInputTarget(target) {
    const tagName = target?.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target?.isContentEditable === true;
  }

  normalizeBindings(bindings = {}) {
    const normalized = getDefaultShortcutBindings();

    for (const command of SHORTCUT_COMMANDS) {
      const value = this.normalizeBindingString(bindings[command.id]);

      if (value) {
        normalized[command.id] = value;
      }
    }

    return normalized;
  }

  normalizeBindingString(binding) {
    if (typeof binding !== 'string' || !binding.trim()) {
      return '';
    }

    const parts = binding.split('+').map((part) => part.trim()).filter(Boolean);
    const modifiers = [];
    let key = '';

    for (const part of parts) {
      const normalizedPart = this.normalizeKey(part);

      if (normalizedPart === 'Ctrl' || normalizedPart === 'Alt' || normalizedPart === 'Shift' || normalizedPart === 'Meta') {
        if (!modifiers.includes(normalizedPart)) {
          modifiers.push(normalizedPart);
        }
      } else {
        key = normalizedPart;
      }
    }

    if (!key) {
      return '';
    }

    return [...modifiers.sort(this.sortModifier), key].join('+');
  }

  normalizeKey(key) {
    if (!key) {
      return '';
    }

    const rawKey = String(key).trim();

    if (!rawKey) {
      return '';
    }

    const lowered = rawKey.toLowerCase();
    const specialKeys = {
      control: 'Ctrl',
      ctrl: 'Ctrl',
      alt: 'Alt',
      shift: 'Shift',
      meta: 'Meta',
      escape: 'Escape',
      esc: 'Escape',
      del: 'Delete',
      delete: 'Delete',
      insert: 'Insert',
      ' ': 'Space',
    };

    if (specialKeys[lowered]) {
      return specialKeys[lowered];
    }

    if (/^arrow(left|right|up|down)$/i.test(rawKey)) {
      return `Arrow${rawKey.slice(5, 6).toUpperCase()}${rawKey.slice(6).toLowerCase()}`;
    }

    if (rawKey.length === 1) {
      return rawKey.toUpperCase();
    }

    return rawKey[0].toUpperCase() + rawKey.slice(1);
  }

  sortModifier(a, b) {
    const order = ['Ctrl', 'Alt', 'Shift', 'Meta'];
    return order.indexOf(a) - order.indexOf(b);
  }

  rebuildIndex() {
    this.bindingToCommand = new Map();

    for (const command of SHORTCUT_COMMANDS) {
      const binding = this.getBinding(command.id);

      if (binding) {
        this.bindingToCommand.set(binding, command.id);
      }
    }
  }

  persist() {
    this.settings?.setEditorShortcuts?.(this.bindings);
  }
}
