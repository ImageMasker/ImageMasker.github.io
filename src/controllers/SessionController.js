export class SessionController {
  constructor(app) {
    this.app = app;
  }

  bindEvents() {
    const refs = this.app.sessionPanel.refs;

    refs.sessionSelect.addEventListener('change', () => {
      this.app.selectedSessionId = refs.sessionSelect.value;
      const session = this.app.sessionStorage.getSession(this.app.selectedSessionId);
      refs.sessionNameInput.value = session?.name ?? '';
      this.updateSessionStatus(session);
    });

    refs.saveButton.addEventListener('click', () => {
      this.saveCurrentSession();
    });

    refs.loadButton.addEventListener('click', async () => {
      await this.loadSelectedSession();
    });

    refs.duplicateButton.addEventListener('click', () => {
      this.duplicateSelectedSession();
    });

    refs.deleteButton.addEventListener('click', () => {
      this.deleteSelectedSession();
    });

    refs.exportButton.addEventListener('click', async () => {
      await this.exportCurrentSessionJson();
    });

    refs.importButton.addEventListener('click', () => {
      refs.importInput.click();
    });

    refs.importInput.addEventListener('change', async (event) => {
      const [file] = event.target.files || [];

      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const document = JSON.parse(text);
        const restored = await this.restoreSessionDocument(document);

        if (restored) {
          this.app.notify('Session JSON imported.', 'success');
        }
      } catch {
        this.app.notify('Could not import session JSON.', 'error');
      } finally {
        refs.importInput.value = '';
      }
    });

    refs.restoreButton.addEventListener('click', async () => {
      const autosave = this.app.sessionStorage.getAutosave();

      if (!autosave?.canRestore) {
        return;
      }

      await this.restoreSessionDocument(autosave);
      this.app.sessionPanel.hideRestorePrompt();
      this.app.notify('Autosaved session restored.', 'success');
    });

    refs.discardButton.addEventListener('click', () => {
      this.app.sessionStorage.clearAutosave();
      this.app.sessionPanel.hideRestorePrompt();
      this.updateSessionStatus(this.app.sessionStorage.getSession(this.app.selectedSessionId));
      this.app.notify('Autosave discarded.', 'success');
    });
  }

  renderSessions() {
    const sessions = this.app.sessionStorage.getSessions();
    this.app.sessionPanel.renderSessions(sessions, this.app.selectedSessionId);
    this.updateSessionStatus(this.app.sessionStorage.getSession(this.app.selectedSessionId));
  }

  updateSessionStatus(session = null) {
    const autosave = this.app.sessionStorage.getAutosave();
    const autosaveLabel = autosave
      ? autosave.canRestore
        ? `Autosave available from ${new Date(autosave.savedAt).toLocaleString()}.`
        : 'Autosave exists, but its local-image background cannot be restored automatically.'
      : 'No autosave stored.';
    const sessionLabel = session
      ? `Selected session: ${session.name}${session.canRestore ? '' : ' (local image)'}.`
      : 'No session selected.';

    this.app.sessionPanel.setStatus(`${autosaveLabel} ${sessionLabel}`);
    this.app.sessionPanel.refs.loadButton.disabled = !session || !session.canRestore;
    this.app.sessionPanel.refs.duplicateButton.disabled = !session;
    this.app.sessionPanel.refs.deleteButton.disabled = !session;
  }

  maybeShowRestorePrompt() {
    const autosave = this.app.sessionStorage.getAutosave();

    if (!autosave) {
      this.app.sessionPanel.hideRestorePrompt();
      return;
    }

    this.app.sessionPanel.showRestorePrompt(autosave);
    this.updateSessionStatus(this.app.sessionStorage.getSession(this.app.selectedSessionId));

    if (autosave.canRestore) {
      this.app.openSettings('sessions');
    }
  }

  saveCurrentSession() {
    const document = this.app.serializeCurrentSession();

    if (!document) {
      this.app.notify('Load an image before saving a session.', 'warning');
      return;
    }

    const refs = this.app.sessionPanel.refs;
    const existing = this.app.sessionStorage.getSession(this.app.selectedSessionId);
    const sessionRecord = this.app.sessionStorage.saveSession({
      id: existing?.id ?? null,
      name: refs.sessionNameInput.value || existing?.name || undefined,
      document,
    });

    this.app.selectedSessionId = sessionRecord.id;
    refs.sessionNameInput.value = sessionRecord.name;
    this.renderSessions();
    this.app.notify(
      document.canRestore
        ? 'Session saved.'
        : 'Session saved, but local-image backgrounds cannot be restored automatically.',
      document.canRestore ? 'success' : 'warning',
      document.canRestore ? 2400 : 3800
    );
  }

  async loadSelectedSession() {
    const session = this.app.sessionStorage.getSession(this.app.selectedSessionId);

    if (!session) {
      this.app.notify('Select a saved session first.', 'warning');
      return;
    }

    const restored = await this.restoreSessionDocument(session.document);

    if (restored) {
      this.app.notify('Session restored.', 'success');
    }
  }

  duplicateSelectedSession() {
    if (!this.app.selectedSessionId) {
      this.app.notify('Select a saved session first.', 'warning');
      return;
    }

    const duplicate = this.app.sessionStorage.duplicateSession(this.app.selectedSessionId);

    if (!duplicate) {
      this.app.notify('Could not duplicate session.', 'error');
      return;
    }

    this.app.selectedSessionId = duplicate.id;
    this.app.sessionPanel.refs.sessionNameInput.value = duplicate.name;
    this.renderSessions();
    this.app.notify('Session duplicated.', 'success');
  }

  deleteSelectedSession() {
    if (!this.app.selectedSessionId) {
      this.app.notify('Select a saved session first.', 'warning');
      return;
    }

    this.app.sessionStorage.deleteSession(this.app.selectedSessionId);
    this.app.selectedSessionId = '';
    this.app.sessionPanel.refs.sessionNameInput.value = '';
    this.renderSessions();
    this.app.notify('Session deleted.', 'success');
  }

  async exportCurrentSessionJson() {
    const sessionDocument = this.app.serializeCurrentSession();

    if (!sessionDocument) {
      this.app.notify('Load an image before exporting a session.', 'warning');
      return;
    }

    const sessionName = this.app.sessionPanel.refs.sessionNameInput.value.trim() || 'imagemasker-session';
    const blob = new Blob([JSON.stringify(sessionDocument, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sessionName}.imagemasker.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.app.notify('Session JSON exported.', 'success');
  }

  async restoreSessionDocument(document) {
    if (!document?.canRestore) {
      this.app.notify('This session cannot be restored automatically because it used a local image.', 'warning', 4200);
      return false;
    }

    this.app.isRestoringSession = true;
    let didRestore = false;

    try {
      didRestore = await this.app.applySceneSnapshot(document);
      return didRestore;
    } finally {
      this.app.isRestoringSession = false;
      this.updateSessionStatus(this.app.sessionStorage.getSession(this.app.selectedSessionId));
      if (didRestore) {
        this.app.queueAutosave();
      }
    }
  }
}
