// Rounds saved without uploading: the finished picture (a flattened JPEG, no layers or history)
// is kept in IndexedDB next to the sessions. Uploaded rounds stay in localStorage ('rounds'),
// which the previous version shares.

function request(operation) {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}

export class LocalRounds {
  constructor(sessionStore) {
    this.sessionStore = sessionStore;
    this.askedForPersistence = false;
  }

  async store(mode) {
    const database = await this.sessionStore.open();

    return database.transaction('rounds', mode).objectStore('rounds');
  }

  async list() {
    const all = await request((await this.store('readonly')).getAll());

    return all.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  async add({ blob, title, answer, width, height }) {
    if (!this.askedForPersistence) {
      // Ask the browser not to clear these when it runs low on space. It may say no; that's fine.
      this.askedForPersistence = true;
      void navigator.storage?.persist?.().catch(() => {});
    }

    const round = {
      id: `round-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      title,
      answer,
      blob,
      width,
      height,
    };

    await request((await this.store('readwrite')).put(round));
    return round;
  }

  async update(id, patch) {
    const store = await this.store('readwrite');
    const round = await request(store.get(id));

    if (round) {
      await request(store.put({ ...round, ...patch }));
    }
  }

  async remove(id) {
    await request((await this.store('readwrite')).delete(id));
  }
}
