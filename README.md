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

* **Effects** – masks that reshape the picture instead of covering it: cut glass, stained glass, reeded glass, textured glass (hammered, pebbled, flemish, rippled, seedy), glass blocks, rainy window, pond ripples, water surface, jigsaw, shuffled tiles, hex mirrors, shattered, woven strips, turning rings, liquid warp, halftone, engraving, pointillism, pencil sketch, cross-stitch, glitch, VHS and more. The glass and water effects refract the picture through a textured surface, with colour fringes and highlights you can dial in. The defaults are tuned so the picture stays recognisable; **Gentle / Strong** (they only change the effect's strength sliders and keep the rest, e.g. pane size), **Reset** and **Mix with original** change that in one click; less-used sliders sit under *More settings*. Effects that turn around a centre (swirl, fisheye, kaleidoscope, turning rings, …) show a ⊕ on the picture you can drag. **Tinted glass** is cut glass with larger, softly coloured panes, and Cut glass has a pane tint slider, and the few effects that really hide the subject sit in their own *Heavy* group. Seeded effects have a **Shuffle** button. An effect can cover the whole picture, be limited to a rectangle / ellipse / freehand region, or be painted on with the effect brush.
* **Overlays** – the nine classic image masks, then procedural patterns (lattice, mesh, honeycomb, stripes, zebra, polka dots, seigaiha, truchet, camo, …) with editable colours and a transparent background by default. *Mask zoom* scales the whole pattern; *Density* adds more repeats while lines and dots keep their size.
* **Flags** – the searchable flag masks.
* **Custom** – your own mask URLs (saved in the browser) or a local image file.

Overlay masks are slightly rotated and skewed when added so they are harder to subtract, and have opacity, zoom, angle, blend mode, hue, invert, blur, noise and warp controls.

The little bar on each effect tile is a rough guide to how hard it scrambles the picture. **No mask is guaranteed to beat reverse image search** – always use *Check RIS* before posting.

### Tools

Move/select (resize and rotate with the handles, Shift+click for multi-select), brush (smooth, marker, dotted, spray), eraser, blur brush, pixel brush, effect brush (any effect), effect region, rectangle, text (double-click to edit in place; font, alignment, bold/italic, outline, shadow) and crop/resize canvas (drag the frame past the edge to add space).

The eraser has three modes: **Erase drawings**, **Reveal original** (brushes through every mask and effect to show the untouched picture, e.g. to give a hint or keep one detail clear) and **Restore masks** (paints the masks back). Masks you add later stay underneath the revealed area.

Mouse wheel zooms, Space+drag or middle mouse pans. Hold **Original** in the header to see the picture without masks.

### Sharing

The **Share** tab has the round title / answer and **Copy image & post to Reddit**, the main way to submit:

* **Copy image & post to Reddit** – needs no image host. It copies the picture to the clipboard and opens Reddit's image post form for /r/PictureGame with `[Round N]` and your title filled in (N is the next round number from picturega.me). Press CTRL+V there to attach the picture and submit.
* **Upload to an image host** (collapsed) – uploads to the chosen host and gives you the image URL, *Copy*, *Check RIS* (opens Yandex, TinEye, Google Lens, Google and Bing – allow popups), *Submit to /r/PictureGame* (link post), *Save round* and *Copy YML*.

Image hosts: **Imgur** (blocked in the UK since September 2025), **ImgBB** (works in the UK; needs a free API key from https://api.imgbb.com/, stored in your browser) and **Litterbox** (no account, but links expire after 72 hours, so only for short rounds). Saved rounds are listed at the bottom of the tab.

Export settings (presets, size, format, JPEG quality) are in a collapsed section of the Share tab and apply to Copy and Download in the header and to uploads.

**Settings** has saved sessions (stored in the browser, pictures included, with autosave and JSON export/import), themes (the built-in ones plus JSON themes) and remappable keyboard shortcuts. **Remove background** is in the properties of an image layer (or of the picture when nothing is selected); it runs in your browser and adds the cut-out as a new layer.

### Keyboard shortcuts (defaults, all remappable)

* CTRL+Z / CTRL+Y: undo / redo
* V, B, E: move, brush, eraser. Shift+E: eraser in reveal-original mode. G / X: blur brush / pixel brush. Shift+G: effect brush. A: region. R: rectangle. T: text. C: crop
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
