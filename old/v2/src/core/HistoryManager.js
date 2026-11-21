export class HistoryManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(command) {
    command.redo?.();
    this.pushExecuted(command);
  }

  pushExecuted(command) {
    if (!command?.undo || !command?.redo) {
      return;
    }

    this.undoStack.push(command);
    this.redoStack = [];
  }

  undo() {
    const command = this.undoStack.pop();

    if (!command) {
      return false;
    }

    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo() {
    const command = this.redoStack.pop();

    if (!command) {
      return false;
    }

    command.redo();
    this.undoStack.push(command);
    return true;
  }
}
