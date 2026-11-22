// Session commands mixed into App: named sessions and the autosave.

import { AUTOSAVE_ID, describeSession, restoreSession } from './sessions.js';

export class SessionCommands {
  async saveSession(id, name) {
    const payload = describeSession(this);
    const records = new Map();

    for (const assetId of payload.assetIds) {
      records.set(assetId, await this.assets.serialize(assetId));
    }

    await this.sessionStore.save({ id, name, updatedAt: payload.savedAt, ...payload }, records);
  }

  async loadSession(id) {
    const stored = await this.sessionStore.load(id);

    if (!stored) {
      throw new Error('That session no longer exists.');
    }

    return this.importSession({ doc: stored.session.doc, ui: stored.session.ui, assets: stored.assets });
  }

  async importSession(payload) {
    this.restoring = true;

    try {
      return await restoreSession(this, payload);
    } finally {
      this.restoring = false;
    }
  }

  queueAutosave() {
    if (!this.store.hasImage || this.restoring) {
      return;
    }

    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => void this.persistAutosave(), 1500);
  }

  async persistAutosave() {
    if (!this.store.hasImage || this.restoring) {
      return;
    }

    if (this.store.gestureBase) {
      this.queueAutosave();
      return;
    }

    clearTimeout(this.autosaveTimer);

    try {
      await this.saveSession(AUTOSAVE_ID, 'Autosave');
    } catch (error) {
      console.warn('Autosave failed', error);
    }
  }

  async checkAutosave() {
    try {
      if (!this.store.hasImage && (await this.sessionStore.hasAutosave())) {
        this.refs.restoreBanner.classList.remove('hidden');
        this.settingsUi.showRestorePrompt(true);
      }
    } catch {
      // IndexedDB can be unavailable (private windows); the editor works without it.
    }
  }

  async restoreAutosave() {
    try {
      const dropped = await this.loadSession(AUTOSAVE_ID);

      this.settingsUi.close();
      this.notify(dropped.length ? `Restored, but some layers were lost: ${dropped.join(', ')}.` : 'Session restored.', dropped.length ? 'warning' : 'success', 3600);
    } catch (error) {
      this.notify(`The autosave could not be restored. ${error.message}`, 'error', 4200);
    }
  }

  async discardAutosave() {
    this.refs.restoreBanner.classList.add('hidden');
    this.settingsUi.showRestorePrompt(false);

    try {
      await this.sessionStore.remove(AUTOSAVE_ID);
    } catch {
      // Nothing to clean up.
    }
  }
}
