import { cloneJson, normalizeSceneDocument } from '../document/SceneDocument.js';

const AUTOSAVE_KEY = 'imagemasker.autosave';
const SESSIONS_KEY = 'imagemasker.sessions';

export class SessionStorage {
  getAutosave() {
    const stored = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
    return normalizeSceneDocument(stored);
  }

  setAutosave(document) {
    const normalized = normalizeSceneDocument(document);

    if (!normalized) {
      this.clearAutosave();
      return null;
    }

    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
  }

  getSessions() {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
      .map((session) => {
        const document = normalizeSceneDocument(session.document);

        if (!document) {
          return null;
        }

        return {
          ...session,
          document,
          canRestore: Boolean(document.canRestore),
        };
      })
      .filter(Boolean);
  }

  getSession(sessionId) {
    return this.getSessions().find((session) => session.id === sessionId) ?? null;
  }

  saveSession({ id = null, name, document }) {
    const sessions = this.getSessions();
    const now = new Date().toISOString();
    const existingIndex = id ? sessions.findIndex((session) => session.id === id) : -1;
    const normalizedDocument = normalizeSceneDocument(document);
    const sessionRecord = {
      id: id ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name?.trim() || `Session ${sessions.length + 1}`,
      createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : now,
      updatedAt: now,
      canRestore: Boolean(normalizedDocument?.canRestore),
      document: cloneJson(normalizedDocument),
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = sessionRecord;
    } else {
      sessions.push(sessionRecord);
    }

    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return sessionRecord;
  }

  duplicateSession(sessionId) {
    const session = this.getSession(sessionId);

    if (!session) {
      return null;
    }

    return this.saveSession({
      name: `${session.name} copy`,
      document: session.document,
    });
  }

  deleteSession(sessionId) {
    const sessions = this.getSessions();
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(nextSessions));
    return nextSessions;
  }
}
