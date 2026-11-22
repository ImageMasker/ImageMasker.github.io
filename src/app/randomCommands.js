// Random mask commands mixed into App, and the header's Random mask ▾ menu.

import { findLayer, insertMask, removeLayers } from '../core/model.js';
import { choiceGroup } from '../ui/Dropdown.js';
import { el } from '../utils/dom.js';
import { bandDistance, buildRandomMask, planRandomMask, RANDOM_KINDS, RANDOM_LEVELS, rememberPicks } from './randomMask.js';
import { changeScore, renderSmall, unmaskedDoc } from './strengthMeter.js';

const RANDOM_SETTINGS_KEY = 'imagemasker.randomMask';

export class RandomCommands {
  /**
   * Adds a random mask at the strength chosen in its menu. Candidates are rendered small and
   * measured (strengthMeter.js) until one lands in the band for that strength. On a collage
   * every picture gets its own mask. Pressing it again swaps the previous random layers for new
   * ones in a single undo step, so it can be used to roll until one fits.
   */
  async randomizeMasks({ silent = false, piece = this.activeCollageTarget() } = {}) {
    if (!this.requireImage('Load an image before adding a mask.') || this.randomizing) {
      return false;
    }

    this.randomizing = true;
    this.randomMenu.close();

    try {
      const { level, kinds } = this.getRandomSettings();
      const allCells = this.collageCells();
      const onePiece = Boolean(allCells) && piece !== null && piece >= 0 && piece < allCells.length;
      // Rerolling one piece keeps the random masks of the others.
      const previous = (this.randomLayerIds ?? []).filter((id) => {
        const layer = findLayer(this.store.doc, id);

        return layer && (!onePiece || layer.clip?.piece === piece);
      });
      const kept = (this.randomLayerIds ?? []).filter((id) => !previous.includes(id) && findLayer(this.store.doc, id));
      const baseDoc = removeLayers(this.store.doc, previous);
      const cells = allCells && (onePiece ? [allCells[piece]] : allCells);
      const regions = cells ?? [null];
      const size = cells ? 480 : 224;
      const original = renderSmall(this.stage, unmaskedDoc(baseDoc), size);
      const loadPreset = (preset) => this.assets.fromPath(preset.full, { name: preset.name });
      const chosen = [];

      for (const [index, region] of regions.entries()) {
        let best = null;

        for (let attempt = 0; attempt < 10; attempt += 1) {
          const plan = planRandomMask({ level, kinds });

          if (!plan) {
            break;
          }

          const built = await buildRandomMask(baseDoc, plan, loadPreset, region);
          const candidate = built.layers.reduce((current, layer) => insertMask(current, layer), baseDoc);
          const distance = bandDistance(level, changeScore(original, renderSmall(this.stage, candidate, size), region?.rect));

          if (!best || distance < best.distance) {
            best = { ...built, plan, distance };
          }

          if (distance === 0) {
            break;
          }
        }

        if (!best) {
          this.notify(
            'Nothing to pick from: tick more kinds in the Random mask menu.',
            'warning',
            4200
          );
          return false;
        }

        rememberPicks(best.plan);
        chosen.push({
          layers: region ? best.layers.map((layer) => ({ ...layer, name: `Picture ${region.piece + 1}: ${layer.name}` })) : best.layers,
          names: best.names,
        });
      }

      const layers = chosen.flatMap((entry) => entry.layers);

      this.textEditor.close();
      this.store.apply(previous.length ? 'Reroll random mask' : 'Random mask', (doc) =>
        layers.reduce((current, layer) => insertMask(current, layer), removeLayers(doc, previous))
      );
      this.randomLayerIds = [...kept, ...layers.map((layer) => layer.id)];
      this.store.select([layers[layers.length - 1].id]);
      this.setTool('select');
      this.revealEditor();

      if (!silent) {
        const what = onePiece ? `picture ${piece + 1}, ${chosen[0].names.join(' + ')}` : cells ? `${cells.length} pictures masked separately` : chosen[0].names.join(' + ');

        this.notify(`Random ${level} mask: ${what}. Press again for another one.`, 'success', 3200);
      }

      return true;
    } catch (error) {
      console.error(error);
      this.notify('The random mask could not be added.', 'error');
      return false;
    } finally {
      this.randomizing = false;
    }
  }

  getRandomSettings() {
    const all = RANDOM_KINDS.map((kind) => kind.id);

    try {
      const stored = JSON.parse(localStorage.getItem(RANDOM_SETTINGS_KEY) ?? 'null');
      const kinds = Array.isArray(stored?.kinds) ? stored.kinds.filter((id) => all.includes(id)) : all;

      return {
        level: RANDOM_LEVELS.some((level) => level.id === stored?.level) ? stored.level : 'medium',
        kinds: kinds.length ? kinds : all,
      };
    } catch {
      return { level: 'medium', kinds: all };
    }
  }

  setRandomSettings(patch) {
    localStorage.setItem(RANDOM_SETTINGS_KEY, JSON.stringify({ ...this.getRandomSettings(), ...patch }));
    this.updateRandomTitle();
  }

  renderRandomMenu() {
    const settings = this.getRandomSettings();
    const levels = choiceGroup({
      title: 'Strength',
      type: 'radio',
      name: 'randomStrength',
      options: RANDOM_LEVELS,
      isChecked: (id) => id === settings.level,
      onChange: (id) => this.setRandomSettings({ level: id }),
    });
    const kinds = choiceGroup({
      title: 'Pick from',
      options: RANDOM_KINDS,
      isChecked: (id) => settings.kinds.includes(id),
      onChange: (_, input, inputs) => {
        const ids = RANDOM_KINDS.filter((_, index) => inputs[index].checked).map((kind) => kind.id);

        if (!ids.length) {
          input.checked = true;
          this.notify('Keep at least one kind ticked.', 'info');
          return;
        }

        this.setRandomSettings({ kinds: ids });
      },
    });

    this.randomMenu.element.replaceChildren(...levels, el('div', { className: 'context-menu-separator', role: 'separator' }), ...kinds);
  }

  updateRandomTitle() {
    const { level } = this.getRandomSettings();
    const label = RANDOM_LEVELS.find((entry) => entry.id === level).label.toLowerCase();

    this.refs.random.title = `Add a random ${label} mask (${this.keyboard?.getBinding('randomMask') ?? ''}). Press again for a different one.`;
  }
}
