// Reverse image search commands mixed into App: the RIS ▾ menu, uploading for a check and Crop RIS.

import { RIS_ENGINES } from '../integrations/RISChecker.js';
import { choiceGroup } from '../ui/Dropdown.js';
import { button } from '../ui/kit.js';
import { el } from '../utils/dom.js';

export class RisCommands {
  renderRisMenu() {
    const selected = new Set(this.risChecker.getEngineIds());
    const [title, ...items] = choiceGroup({
      title: 'Search on',
      options: RIS_ENGINES,
      isChecked: (id) => selected.has(id),
      onChange: (_, input, inputs) => {
        const ids = RIS_ENGINES.filter((_, index) => inputs[index].checked).map((engine) => engine.id);

        if (!ids.length) {
          input.checked = true;
          this.notify('Keep at least one RIS site ticked.', 'info');
          return;
        }

        this.risChecker.setEngineIds(ids);
        this.updateRisTitle();
      },
    });
    const all = button('Tick all', {
      className: 'dropdown-wide',
      onClick: () => {
        items.forEach((item) => (item.querySelector('input').checked = true));
        this.risChecker.setEngineIds(RIS_ENGINES.map((engine) => engine.id));
        this.updateRisTitle();
      },
    });

    this.risMenu.element.replaceChildren(title, ...items, el('div', { className: 'context-menu-separator', role: 'separator' }), all);
  }

  updateRisTitle() {
    const ids = this.risChecker.getEngineIds();
    const names = RIS_ENGINES.filter((engine) => ids.includes(engine.id)).map((engine) => engine.label);
    const host = this.imageHosts.getHost(this.imageHosts.risHostId()).label;

    this.refs.ris.title = `Upload to ${host} and search ${names.length === RIS_ENGINES.length ? 'every RIS site' : names.join(', ')} (${this.keyboard?.getBinding('checkRis') ?? ''})`;
  }

  /**
   * Remembers which version of the picture an uploaded URL shows, so it is not uploaded twice.
   * `keep` marks a lasting upload to the chosen host; RIS-only uploads may expire within the hour.
   */
  noteUpload(doc, options, url, { keep = true, hostId = this.imageHosts.getHostId() } = {}) {
    this.lastUpload = { doc, key: JSON.stringify(options), hostId, keep, url, at: Date.now() };
  }

  reusableUpload(doc, options, { keep }) {
    const last = this.lastUpload;

    if (!last?.url || last.doc !== doc || last.key !== JSON.stringify(options)) {
      return null;
    }

    // A lasting upload also serves RIS checks; a one-hour one only RIS checks within the hour.
    if (keep) {
      return last.keep && last.hostId === this.imageHosts.getHostId() ? last.url : null;
    }

    return last.keep || Date.now() - last.at < 45 * 60 * 1000 ? last.url : null;
  }

  /** Uploads the picture to the chosen host and keeps the link (Save round with upload). */
  async uploadPicture() {
    const doc = this.store.doc;
    const options = this.sharePanel.getExportOptions();
    const reused = this.reusableUpload(doc, options, { keep: true });

    if (reused) {
      return reused;
    }

    const url = await this.imageHosts.upload(await this.exportBlob(options));

    this.noteUpload(doc, options, url);
    this.sharePanel.setUploaded(url);
    this.queueAutosave();
    return url;
  }

  /** Puts the picture online for a RIS check (Litterbox for an hour in the UK, see ImageHosts). */
  async uploadForRis() {
    const doc = this.store.doc;
    const options = this.sharePanel.getExportOptions();
    const reused = this.reusableUpload(doc, options, { keep: false });

    if (reused) {
      return reused;
    }

    const { url, hostId } = await this.imageHosts.uploadForRis(await this.exportBlob(options), (label) => this.notifyRisFallback(label));
    const keep = hostId === this.imageHosts.getHostId();

    this.noteUpload(doc, options, url, { keep, hostId });

    // Only a lasting link belongs in the Share tab (for link posts and Copy YML).
    if (keep) {
      this.sharePanel.setUploaded(url);
      this.queueAutosave();
    }

    return url;
  }

  notifyRisFallback(label) {
    this.notify(`The upload to ${label} failed, so this RIS check uses Litterbox (the link expires in an hour).`, 'warning', 5200);
  }

  /** Uploads the current picture in the background and opens the ticked RIS sites with it. */
  async checkRis() {
    if (!this.requireImage('Load an image before checking RIS.') || this.risBusy) {
      return;
    }

    const label = this.refs.ris.querySelector('span:last-child');

    this.risMenu.close();
    this.risBusy = true;
    this.refs.ris.disabled = true;
    label.textContent = 'Uploading…';

    try {
      // Must run before the first await: the waiting tab is opened inside the click.
      await this.risChecker.checkPending(() => this.uploadForRis());
    } catch (error) {
      console.error(error);
      this.notify(`The upload for the RIS check failed. ${error.message} You can switch image host in the Share tab.`, 'error', 6200);
    } finally {
      this.risBusy = false;
      label.textContent = 'Check RIS';
      this.syncChrome();
    }
  }

  startCropRis() {
    if (!this.requireImage('Load an image before checking RIS.')) {
      return;
    }

    if (this.toolName === 'risCrop') {
      this.setTool('select');
      return;
    }

    this.store.select([]);
    this.setTool('risCrop');
    this.notify(`Drag a box over the part to search (${this.risChecker.getEngineIds().length} RIS sites). Esc cancels.`, 'info', 4200);
  }

  /** Uploads just `rect` (document pixels) of the finished picture and searches it. */
  async checkRisArea(rect) {
    if (this.risBusy) {
      return;
    }

    this.risBusy = true;
    this.syncChrome();
    this.textEditor.close();

    try {
      // No await before this call: the waiting tab has to open inside the pointer-up.
      await this.risChecker.checkPending(async () => {
        const doc = this.store.doc;
        // Full resolution, but no more than about 2400 px across the crop.
        const scale = Math.min(1, 2400 / Math.max(rect.width, rect.height));
        const full = this.stage.renderToCanvas(doc, { scale });
        const k = full.width / doc.width;
        const crop = document.createElement('canvas');

        crop.width = Math.max(1, Math.round(rect.width * k));
        crop.height = Math.max(1, Math.round(rect.height * k));
        crop.getContext('2d').drawImage(full, rect.x * k, rect.y * k, rect.width * k, rect.height * k, 0, 0, crop.width, crop.height);

        const blob = await new Promise((resolve) => crop.toBlob(resolve, 'image/png'));

        if (!blob) {
          throw new Error('The area could not be encoded.');
        }

        return (await this.imageHosts.uploadForRis(blob, (label) => this.notifyRisFallback(label))).url;
      });
    } catch (error) {
      console.error(error);
      this.notify(`The upload for the RIS check failed. ${error.message} You can switch image host in the Share tab.`, 'error', 6200);
    } finally {
      this.risBusy = false;
      this.syncChrome();
    }
  }
}
