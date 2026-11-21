// Draws a collage with Canvas 2D: background, then each picture cover-fitted into its piece and
// clipped to the piece's shape. Used for the dialog preview (small) and the final picture.

/** Where a picture lands inside `box` (cover fit, then the piece's own zoom and focus). */
export function placement(slot, box) {
  const scale = Math.max(box.width / slot.width, box.height / slot.height) * slot.zoom;
  const width = slot.width * scale;
  const height = slot.height * scale;

  return {
    x: box.x + (box.width - width) * slot.fx,
    y: box.y + (box.height - height) * slot.fy,
    width,
    height,
  };
}

export function tracePolygon(ctx, polygon, scale) {
  ctx.beginPath();
  polygon.forEach((point, index) => (index ? ctx.lineTo(point.x * scale, point.y * scale) : ctx.moveTo(point.x * scale, point.y * scale)));
  ctx.closePath();
}

/**
 * `pieces`: [{ polygon, box }] in full-size pixels (polygon may be null when the gap swallowed it);
 * `slots[i]`: the picture for piece i or null. `emptyFill` paints empty pieces (preview only).
 */
export function drawCollage(ctx, { width, height, pieces, slots, background, scale = 1, emptyFill = null }) {
  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width * scale, height * scale);

  pieces.forEach(({ polygon, box }, index) => {
    if (!polygon) {
      return;
    }

    const slot = slots[index];

    if (!slot) {
      if (emptyFill) {
        tracePolygon(ctx, polygon, scale);
        ctx.fillStyle = emptyFill;
        ctx.fill();
      }
      return;
    }

    const spot = placement(slot, box);

    ctx.save();
    tracePolygon(ctx, polygon, scale);
    ctx.clip();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(slot.source, spot.x * scale, spot.y * scale, spot.width * scale, spot.height * scale);
    ctx.restore();
  });

  ctx.restore();
}
