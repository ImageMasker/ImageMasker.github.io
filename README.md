# [ImageMasker.github.io](https://imageMasker.github.io)

### Image masker for /r/PictureGame

Version 3 is a rewrite around a small custom WebGL2 engine (no canvas library, no build step). Everything is a non-destructive layer, the preview and the export share one render path, and exports are rendered at the full resolution of your picture.

The previous version is kept, working, at [`old/v2/`](./old/v2/) (Settings → About links to it).

### Loading an image

* Click the canvas and pick a file, or use **Share → Add image**
* Drag and drop anywhere on the page
* Paste (CTRL+V) an image or an image URL, or type a URL into the URL box

Once a picture is loaded, pasting adds new images as layers ("Paste as new layer" in **Share → Add image**; turn it off to replace the base picture instead). Replacing the base picture keeps your masks.

### Masks

The **Masks** library on the left has four tabs. Clicking a mask replaces the selected mask so you can browse quickly; Shift+click (or the + on a tile) stacks another one.

* **Effects** – masks that reshape the picture instead of covering it: cut glass, stained glass, reeded glass, glass blocks, rainy window, jigsaw, shuffled tiles, hex mirrors, shattered, woven strips, turning rings, kaleidoscope, liquid warp, halftone, engraving, pointillism, pencil sketch, cross-stitch, glitch, VHS and more. Every effect has its own sliders and (where it makes sense) a **Shuffle** button for a new random arrangement. An effect can cover the whole picture, be limited to a rectangle / ellipse / freehand region, or be painted on with the effect brush.
* **Overlays** – procedural patterns (lattice, mesh, honeycomb, stripes, zebra, polka dots, seigaiha, truchet, camo, …) with editable colours, plus the nine classic image masks.
* **Flags** – the searchable flag masks.
* **Custom** – your own mask URLs (saved in the browser) or a local image file.

Overlay masks are slightly rotated and skewed when added so they are harder to subtract, and have opacity, zoom, angle, blend mode, hue, invert, blur, noise and warp controls.

The little bar on each effect tile is a rough guide to how hard it scrambles the picture. **No mask is guaranteed to beat reverse image search** – always use *Check RIS* before posting.

### Tools

Move/select (resize and rotate with the handles, Shift+click for multi-select), brush (smooth, marker, dotted, spray), eraser, effect brush, effect region, rectangle, text (double-click to edit in place; font, alignment, bold/italic, outline, shadow) and crop/resize canvas (drag the frame past the edge to add space).

Mouse wheel zooms, Space+drag or middle mouse pans. Hold **Original** in the header to see the picture without masks.

### Sharing

The **Share** tab holds the export settings (Original PNG, Editor PNG, Web JPEG, Original JPEG), copy to clipboard, download and **Upload to Imgur**. After an upload you get the image URL, *Copy*, *Check RIS* (opens Yandex, TinEye, Google Lens, Google and Bing – allow popups), round title / answer, *Submit to /r/PictureGame*, *Save round* and *Copy YML*. Saved rounds are listed at the bottom of the tab.

**Settings** has saved sessions (stored in the browser, pictures included, with autosave and JSON export/import), themes (the built-in ones plus JSON themes) and remappable keyboard shortcuts. The **AI** tab has background removal and prompt-based AI edits.

### Keyboard shortcuts (defaults, all remappable)

* CTRL+Z / CTRL+Y: undo / redo
* V, B, E: move, brush, eraser. G / X: effect brush (blur / pixelate). A: region. R: rectangle. T: text. C: crop
* D: duplicate. Delete: delete selection
* W / S: brush size up / down
* Up / down: opacity of the selection (or of the top layer)
* Left / right: rotate the selection; browse saved rounds while they are open
* Shift+arrows: nudge the selection
* F: fit to screen. O: toggle original. Escape: deselect
* Insert: change the subreddit the round is submitted to

### Adding an imgur token
If you want your uploads to have a higher quality and a higher size limit you can put an imgur token (Share → Imgur access token).
- go to https://api.imgur.com/oauth2/addclient
- create an application and copy the client id
- then go to https://api.imgur.com/oauth2/authorize?client_id=CLIENT_ID&response_type=token and put your client id in that url
- authorize your own app to upload images
- it will redirect you to a page with this url https://imgur.com/#access_token=tokenhere
- copy the token and put it in the masker

### Local development

The app uses native ES modules, so it must be served over HTTP (opening `index.html` from disk will not work):

```bash
python -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`. There is nothing to build or install.

* `dev/effect-sheet.html` renders every effect and pattern on one page and lists shader compile errors. Open it after touching `src/gl/effects.js` or `src/gl/patterns.js` (`?img=URL`, `?only=id,id` and `?size=480` are supported).
* [`docs/manual-smoke-test.md`](./docs/manual-smoke-test.md) is a browser checklist for larger changes.
* [`docs/architecture.md`](./docs/architecture.md) explains how the pieces fit together and how to add an effect.

WebGL2 is required (every current desktop and mobile browser has it).
