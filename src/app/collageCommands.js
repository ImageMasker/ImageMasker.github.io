// Collage commands mixed into App: which piece of a collage a point or layer belongs to, and
// opening a finished collage from the Collage dialog.

import { pointInPolygon } from '../core/geometry.js';
import { createDoc, findLayer, imageLayer, updateLayer } from '../core/model.js';
import { regionOptions } from './randomMask.js';

export class CollageCommands {
  /** Picture areas of a collage made with the Collage dialog, or null for a normal picture. */
  collageCells(doc = this.store.doc) {
    const base = doc.layers.find((layer) => layer.base);

    // Cropping or resizing the canvas moves the picture; the stored areas no longer fit then.
    if (!Array.isArray(base?.cells) || Math.abs(base.w - doc.width) > 0.5 || Math.abs(base.h - doc.height) > 0.5 || base.rotation) {
      return null;
    }

    return base.cells.map(({ points }, piece) => {
      const xs = points.filter((_, index) => index % 2 === 0);
      const ys = points.filter((_, index) => index % 2 === 1);
      const rect = { x: Math.min(...xs), y: Math.min(...ys) };

      rect.width = Math.max(...xs) - rect.x;
      rect.height = Math.max(...ys) - rect.y;
      return { rect, points, piece };
    });
  }

  /** Index of the collage piece under a document point, or -1. */
  collagePieceAt(x, y, doc = this.store.doc) {
    return (this.collageCells(doc) ?? []).findIndex((cell) => pointInPolygon(x, y, cell.points));
  }

  /** The piece new masks go to, when the picture is still a collage. */
  activeCollageTarget() {
    const cells = this.collageCells();

    return cells && this.collageTarget !== null && this.collageTarget < cells.length ? this.collageTarget : null;
  }

  setCollageTarget(piece, { quiet = false } = {}) {
    this.collageTarget = piece === null || piece < 0 ? null : piece;
    this.bus.emit('collage-target');

    if (!quiet) {
      this.notify(this.collageTarget === null ? 'New masks cover the whole collage.' : `New masks go on picture ${this.collageTarget + 1} only.`, 'info', 2400);
    }
  }

  /** Patch that limits `layer` to collage piece `piece` (null = the whole picture). */
  piecePatch(layer, piece, doc = this.store.doc) {
    const cells = this.collageCells(doc);
    const cell = piece === null ? null : cells?.[piece];
    // An effect whose area is a whole piece (Random mask, or targeted when added) follows the piece.
    const fitted =
      layer.type === 'effect' &&
      layer.coverage === 'polygon' &&
      (layer.clip || cells?.some(({ rect }) => Math.abs(rect.x + rect.width / 2 - layer.x) < 1 && Math.abs(rect.y + rect.height / 2 - layer.y) < 1 && Math.abs(rect.width - layer.w) < 1));

    if (!cell) {
      const patch = { clip: null };

      if (fitted) {
        Object.assign(patch, { coverage: 'full', points: null, center: null, x: doc.width / 2, y: doc.height / 2, w: doc.width, h: doc.height, rotation: 0, skewX: 0, skewY: 0 });
      }

      return patch;
    }

    const patch = { clip: { piece, points: cell.points } };

    // Effects are fitted to the piece so centred ones (swirl, ripple...) centre on it.
    if (layer.type === 'effect' && (layer.coverage === 'full' || fitted)) {
      const { rect, ...region } = regionOptions(cell);

      Object.assign(patch, region, { center: null, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height, rotation: 0, skewX: 0, skewY: 0 });
    }

    return patch;
  }

  /** Moves a layer onto one collage piece, or back onto the whole picture. */
  setLayerPiece(layerId, piece) {
    const layer = findLayer(this.store.doc, layerId);

    if (!layer || layer.base) {
      return;
    }

    this.store.apply(piece === null ? 'Apply to whole collage' : `Limit to picture ${piece + 1}`, (doc) => updateLayer(doc, layerId, this.piecePatch(layer, piece, doc)));
  }

  /** A new layer as it should be added: limited to the targeted collage piece, if any. */
  targeted(layer) {
    const piece = this.activeCollageTarget();

    return piece === null ? layer : { ...layer, ...this.piecePatch(layer, piece) };
  }

  /**
   * Makes a finished collage the base picture. `cells` are the pieces with a picture (flat point
   * lists in collage pixels); they are kept on the base layer so Random mask masks each piece.
   */
  async openCollage(blob, { width, height, cells, mask = true }) {
    try {
      const asset = await this.assets.fromBlob(blob, { name: 'Collage' });
      const k = asset.width / width;
      const doc = createDoc(asset.width, asset.height);

      doc.layers.push({
        ...imageLayer(doc, asset, { name: 'Collage', base: true }),
        cells: cells.map((points) => ({ points: points.map((value) => value * k) })),
      });

      if (this.store.hasImage) {
        this.textEditor.close();
        this.store.apply('New collage', () => doc);
        this.store.select([]);
        this.afterImageChange();
      } else {
        this.replaceDocument(doc);
      }

      this.sharePanel.setUploaded('');
      this.randomLayerIds = [];

      if (mask && cells.length) {
        await this.randomizeMasks({ silent: true });
      }

      this.notify(
        mask ? `Collage created: ${cells.length} pictures, each with its own mask. Random mask rerolls them; click a piece's mask to edit it.` : 'Collage created. Random mask gives each picture its own mask.',
        'success',
        5200
      );
      return true;
    } catch (error) {
      console.error(error);
      this.notify('The collage could not be created.', 'error');
      return false;
    }
  }
}
