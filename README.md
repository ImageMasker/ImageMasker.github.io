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

The **Masks** library on the left has four tabs: Effects, Overlays, Other and Custom. Clicking a mask replaces the selected mask so you can browse quickly; Shift+click (or the + on a tile) stacks another one.

* **Effects** – masks that reshape the picture instead of covering it: cut glass, stained glass, reeded glass, textured glass (hammered, pebbled, flemish, rippled, seedy), glass blocks, rainy window, pond ripples, water surface, jigsaw, shuffled tiles, hex mirrors, shattered, woven strips, turning rings, liquid warp, halftone, engraving, pointillism, pencil sketch, cross-stitch, glitch, VHS and more. The glass and water effects refract the picture through a textured surface, with colour fringes and highlights you can dial in. The defaults are tuned so the picture stays recognisable; **Gentle / Strong** (they only change the effect's strength sliders and keep the rest, e.g. pane size), **Reset** and **Mix with original** change that in one click; less-used sliders sit under *More settings*. Effects that turn around a centre (swirl, fisheye, kaleidoscope, turning rings, …) show a ⊕ on the picture you can drag. **Tinted glass** is cut glass with larger, softly coloured panes, and Cut glass has a pane tint slider, and the few effects that really hide the subject sit in their own *Heavy* group. Seeded effects have a **Shuffle** button. An effect can cover the whole picture, be limited to a rectangle / ellipse / freehand region, or be painted on with the effect brush.
* **Overlays** – the nine classic image masks (Weave, Bendy weave, The wobbler, Circles, Diamonds, Patches, Leaves, Fruit salad, Red waves), then procedural patterns (lattice, mesh, honeycomb, stripes, zebra, polka dots, seigaiha, truchet, camo, …) with editable colours and a transparent background by default. *Mask zoom* scales the whole pattern; *Density* adds more repeats while lines and dots keep their size.
* **Other** – emoji masks and the searchable flag masks.
  * **Emoji** masks tile emojis across the picture, drawn with Twemoji, Google's blob emojis or the device's emoji font, and can use the PictureGame Discord server's own emojis. Start from a ready-made set (faces, animals, food, PictureGame, Google blobs, …) or *Random*, then in the properties remove emojis by clicking them, add more with the emoji picker (search, categories, recently used), and adjust density, size, size variety, rotation, scatter and an optional background. *Shuffle* rearranges them. All the usual overlay controls (opacity, zoom, angle, blend, hue, blur, warp) apply.
  * **From the picture** picks emojis for what the picture shows with a small image model that runs in your browser (MobileCLIP S0, about 23 MB downloaded the first time, then cached); the picture is not sent anywhere. It knows about 800 emojis and picks the ones that clearly match, plus close relatives (a horse gets 🐴 🐎), so a picture of one thing can get just one or two. Careful: the emojis can hint at the answer.
* **Custom** – your own masks and the community's:
  * **Add image files…** keeps masks in this browser (no image host needed). Turn on *Private copy online* to store them on PictureGame's media server (media.picturega.me) too; they are tied to a random *mask key* (Settings → Masks), not an account, so paste that key on another device to get the same masks there. Only you can see private masks.
  * **Share a mask…** picks an image and submits it to the community list in one go. A mask's **⋯** menu (or right-click) can also rename, download, keep a private copy online, share or delete it. Hover a community mask and click the **★** on its picture to star it: starred masks stay at the top (stars are kept in this browser). Shared masks are reviewed first (the PictureGame Discord bot sends each one to the reviewer by DM with Approve / Reject buttons, where the reviewer can also rename it and choose whether clicking it adds one image or a repeated pattern); once approved they appear under **Community masks** for everyone. Settings → Masks also has the review queue for whoever holds the moderator token.
  * *Mask from a link* downloads the image and keeps it like a picked file (private copy and
    sharing included); the link itself is not kept. Mask URLs saved earlier are still listed and
    can be turned into kept masks the same way.

Overlay masks are slightly rotated and skewed when added so they are harder to subtract, and have opacity, zoom, angle, blend mode, hue, invert, blur, noise and warp controls. Image masks (classic, custom and community) can also be switched to **Repeat as a pattern**: the image is drawn small in staggered rows across the whole picture, like the flag masks, with sliders for the number of rows, its size in each cell and the row offset. Custom and community masks offer *Add as a repeated pattern* in their ⋯ menu.

The little bar on each effect tile is a rough guide to how hard it scrambles the picture. **No mask is guaranteed to beat reverse image search** – always use *Check RIS* before posting.

### Tools

Move/select (resize and rotate with the handles, Shift+click for multi-select), brush (smooth, marker, dotted, spray), eraser, blur brush, pixel brush, effect brush (any effect), effect region, shapes (circle, rectangle, triangle, star, heart; outline or filled, hand-drawn or clean), arrows (drag from start to target, then drag the ends or the middle handle to bend it; open, filled or no head, hand-drawn or clean), text (double-click to edit in place; font, alignment, bold/italic, outline, shadow), crop/resize canvas (drag the frame past the edge to add space) and emoji stamp (pick any emoji or server emoji, click to stamp it at the chosen size and angle, drag for a trail).

The eraser has four modes: **Erase drawings**, **Erase selected layer** (erases only the layer selected in the Layers list – a mask, an image, text, an effect – at the eraser's strength; *Clear erased area* in its properties undoes it all), **Reveal original** (brushes through every mask and effect to show the untouched picture, e.g. to give a hint or keep one detail clear) and **Restore masks** (paints the masks back). Masks you add later stay underneath the revealed area.

Mouse wheel zooms, Space+drag or middle mouse pans. Hold **Original** in the header to see the picture without masks.

### Sharing

The **Share** tab has the round title / answer and **Copy image & post to Reddit**, the main way to submit:

* **Copy image & post to Reddit** – needs no image host. It copies the picture to the clipboard and opens Reddit's image post form for /r/PictureGame with `[Round N]` and your title filled in (N is the next round number from picturega.me). Press CTRL+V there to attach the picture and submit.
* **Share image…** – shown where the browser can share files (most phones): opens the share sheet with the picture, so you can pick the Reddit app. `[Round N] title` goes along as the share text and is also copied, in case the app does not fill it in. If preparing a large picture takes too long the browser refuses; press it again and it shares straight away. Saved rounds kept in this browser have the same button.
* **Upload to an image host** (collapsed) – uploads to the chosen host and gives you the image URL, *Copy*, *Check RIS* (opens Yandex, TinEye, Google Lens, Google and Bing – allow popups), *Submit to /r/PictureGame* (link post), *Save round* and *Copy YML*.

*Check RIS* only needs the picture online briefly: in the UK (detected from the time zone) it uploads to Litterbox for one hour instead of Imgur, and anywhere else it falls back to Litterbox if the chosen host fails. Round pictures are never sent to PictureGame's own servers.

Image hosts: **Imgur** (blocked in the UK since September 2025; Litterbox is the default there), **ImgBB** (works in the UK; needs a free API key from https://api.imgbb.com/, stored in your browser) and **Litterbox** (no account, but links expire after 72 hours, so only for short rounds). **Save round** works without uploading: if nothing was uploaded, the finished picture (a flattened JPEG, capped at 3840 px, usually a few hundred KB to ~2 MB, no layers or history) is kept in this browser with the title and answer. Saved rounds are listed at the bottom of the tab; a locally saved one can be posted with *Copy image & post*, uploaded later, opened in the editor or downloaded.

Right-click the picture for a menu (copy, download, copy & post, save round, paste, layer actions, undo, fit, show original). CTRL+C copies the picture at any time unless you are typing in a text field or have text selected.

Export settings (presets, size, format, JPEG quality) are in a collapsed section of the Share tab and apply to Copy and Download in the header and to uploads.

Tool options (brush size, colour, type and opacity, eraser mode, blur / pixel amounts, effect brush and region choices, the last text style) and the export settings are remembered in your browser for the next visit.

**Settings** has saved sessions (stored in the browser, pictures included, with autosave and JSON export/import), themes (the built-in ones plus JSON themes) and remappable keyboard shortcuts. **Separate background** is in the properties of an image layer (or of the picture when nothing is selected); it runs in your browser and copies the subject into a new layer above the picture, which stays visible, so masks can go between the two. *Circle one item* next to it separates just the item you draw a loop around, for pictures with several things in them. **New** in the header starts from zero after asking (the last picture can still be restored from the start screen). A layer's ↳ button in the Layers list limits it to the layer right below it (a clipping mask), e.g. a mask only on the subject.

### Keyboard shortcuts (defaults, all remappable)

* CTRL+Z / CTRL+Y: undo / redo
* V, B, E: move, brush, eraser. Shift+E: eraser in reveal-original mode. G / X: blur brush / pixel brush. Shift+G: effect brush. A: region. R: shapes. Q: arrow. T: text. C: crop. M: stamp
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
* `dev/tests.html` runs the core logic tests (document model, undo, geometry, collage cuts).
* [`docs/manual-smoke-test.md`](./docs/manual-smoke-test.md) is a browser checklist for larger changes.
* [`docs/architecture.md`](./docs/architecture.md) explains how the pieces fit together and how to add an effect.

WebGL2 is required (every current desktop and mobile browser has it).
