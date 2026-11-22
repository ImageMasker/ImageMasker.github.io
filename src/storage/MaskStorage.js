export class MaskStorage {
  getMasks() {
    const storedMasks = localStorage.getItem('masks');

    if (!storedMasks) {
      return [];
    }

    return storedMasks
      .split(';')
      .map((mask) => mask.trim())
      .filter(Boolean);
  }

  addMask(url) {
    const masks = this.getMasks();
    masks.push(url);
    localStorage.setItem('masks', masks.join(';'));
  }

  removeMask(url) {
    localStorage.setItem('masks', this.getMasks().filter((entry) => entry !== url).join(';'));
  }

  clearAll() {
    localStorage.removeItem('masks');
  }
}
