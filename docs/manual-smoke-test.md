# Manual Smoke Test

This is the lightweight browser checklist for ImageMasker after major feature or refactor work.

## Setup

Serve the repository over HTTP:

```powershell
python -m http.server 8000
```

Open:

- `http://localhost:8000/`

Keep DevTools open and watch the Console for errors.

## Core editor

1. Load an image from local file.
2. Load an image from an external URL.
3. Draw with brush, then erase part of the stroke.
4. Add a preset mask, a flag mask, and a custom mask URL.
5. Change mask opacity, zoom, angle, hue, invert, blur, noise, and warp.
6. Add rectangle, text, blur region, and pixelate region layers.
7. Select, move, resize, rotate, duplicate, and delete each layer type.
8. Shift-click multiple layers, move them together, then undo and redo.
9. Use `Crop / Resize` to crop inward, then expand the canvas outward on at least one edge. Confirm the background and all layers keep their relative placement, undo/redo works, and exporting matches the visible result.

## Text and layers

1. Add text and edit it in place.
2. Test multiline text.
3. Change font, alignment, bold, italic, outline, and shadow.
4. Rename a layer in the layer panel.
5. Hide, lock, reorder, and delete layers from the layer panel.

## Viewport and export

1. Zoom with mouse wheel.
2. Pan with middle mouse and with `Space` + drag.
3. Use `Fit` and `100%`.
4. Export as:
   - `Original PNG`
   - `Editor PNG`
   - `Web JPEG`
   - `Original JPEG`
5. Confirm download, copy to clipboard, and Imgur upload all match the visible editor result.

## Sessions and saved rounds

1. Save a session.
2. Reload and restore autosave.
3. Export session JSON and import it back.
4. Save a round from the editor.
5. Save a round from URL.
6. Open saved rounds, navigate left/right, update title/answer, and delete one.

## Shortcuts

1. `Ctrl+Z` / `Ctrl+Y`
2. `Delete`
3. `W` / `S`
4. Arrow keys
5. `Shift+Arrow`
6. `Insert`

Also verify shortcuts do not fire while typing inside a text input or textarea.

## Mobile / compact layout

1. Switch DevTools to a narrow mobile viewport.
2. Confirm toolbar sections collapse cleanly.
3. Confirm the action bar stays reachable near the top.
4. Confirm touch selection handles are large enough to use.
5. Confirm paste URL and RIS inputs remain usable.

## Session restore limitation

Load a local file, create edits, and reload.

Expected result:

- the app reports that the autosave exists
- the autosave cannot be restored automatically because the original local image is unavailable
