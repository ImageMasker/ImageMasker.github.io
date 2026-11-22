# Manual Smoke Test (v3)

Lightweight browser checklist after larger changes. Serve the repository over HTTP
(`python -m http.server 8000`), open `http://localhost:8000/` and keep the DevTools console open.

## Shaders and core tests

1. Open `dev/effect-sheet.html`. No red error text, every tile shows a picture.
2. Open `dev/tests.html`. Every test passes.

## Loading

1. Load an image by clicking the canvas, by drag and drop, by pasting an image and by pasting / typing an image URL.
2. With a picture loaded, paste another image: it becomes a layer. Turn off "Paste as new layer" and paste again: it replaces the base picture and the masks stay.

## Masks

1. Click several effect masks in a row: each click swaps the effect. Shift+click stacks a second one.
2. Move the sliders, press Gentle, Strong, Shuffle and Reset; Gentle/Strong must keep a custom pane size. Undo and redo each.
2. Select Swirl or Fisheye, drag the ⊕ centre, then Reset centre.
2. Pattern overlay: background transparent by default; Density adds repeats without thickening lines.
3. "Limit to a region", move / resize / rotate the region, change shape, soft edge, magnify, reflect. "Apply to whole picture".
4. *Other → Emoji*: add a set, then in its properties remove an emoji, paste a few (`🐙🦀`), pick from the palette, move every slider, Shuffle, undo. Export and compare. *From the picture* on a photo of an animal or a place picks fitting emojis (first run downloads the model).
4. Select an image mask (classic or custom), turn on *Repeat as a pattern* and move Rows, Size and Row offset; it covers the whole picture at any zoom and angle. A community mask's ⋯ → *Add as a repeated pattern* does the same in one step.
4. *Custom → Share a mask…* opens the file picker and then the share dialog. Star a community mask: it moves to the top and stays starred after a reload.
4. *Custom*: add two image files (one large or GIF); they are kept after a reload. With a local gateway (`localStorage['imagemasker.mediaServer'] = 'http://localhost:8090'`), tick the private copy option, add a file, then ⋯ → *Share with the community…*; approve it in Settings → Masks with the moderator token; it appears under *Community masks* and can be added. Paste the mask key in another browser profile: *Get … masks* restores them.
4. Add a pattern overlay, a classic mask, a flag mask and a custom URL mask. Change opacity, zoom, angle, blend mode, hue, invert, blur, noise, warp, tile.
5. *Random mask* (header, Shift+R) a few times at each strength in its ▾ menu: each press swaps the previous random layers for new ones (one undo step each); Light is easy to recognise, Strong clearly harder. Untick kinds (only Glass, only Overlays): picks stay within them and don't repeat the last few.
6. *Collage*: try several layouts, *Random cuts*, and *Draw cuts* (a long line slices across, a short one splits only its piece); undo a cut. Add pictures with *Choose…*, dropping files and pasting (clicking an empty piece only selects it); drag and scroll to move/zoom inside a piece; drag a picture onto another piece (or a tile in *Pictures* onto another tile) to swap them, into an empty piece to move it; *Shuffle*; change shape, gap and gap colour. *Create collage*: each picture gets its own mask clipped to its piece, Random mask rerolls them all. Pick a picture under *Masks → Add to* (or right-click a picture): library masks, overlays included, and Random mask then only touch that picture. A selected layer's *Collage piece → Show on* moves it to another picture or the whole collage.

## Tools

1. Brush with each brush type, then erase part of a stroke.
2. Blur brush (G), pixel brush (X) and effect brush (Shift+G); change the amount slider; erase part of the painted area with the painted layer selected.
2. Eraser in *Erase selected layer* mode: select an overlay mask in the Layers list and erase part of it; only that mask disappears there. Try 50% strength, undo, and *Clear erased area*.
2. Eraser in *Reveal original* mode over a few stacked masks, then *Restore masks*. Add another mask afterwards: the revealed area must stay clear.
3. Region tool with rectangle, ellipse and freehand.
4. Rectangle and text. Double-click the text and edit it in place; try multiline, font, alignment, bold, italic, outline and shadow.
5. Select, move, resize, rotate, duplicate and delete each layer type. Shift+click several layers and move them together.
6. Crop inward, then extend the canvas past one edge. Undo/redo both. The export must match what is shown.

## Layers

1. Rename (double-click), hide, lock, reorder (buttons and drag) and delete layers.

## Viewport and export

1. Mouse wheel zoom, Space+drag and middle-mouse pan, Fit, 100%, hold Original.
2. Export each preset. Download, copy to clipboard and Imgur upload must match the editor.

## Sharing

1. Check RIS with a URL containing `?a=1&b=2`: every search site gets the full URL.
1. With the computer's time zone set to London, *Check RIS* uploads to Litterbox (1 hour) and the Share tab's link stays empty. Elsewhere it uses the chosen host and falls back to Litterbox if that fails.
1. Header *Check RIS* (Shift+F): a waiting tab opens at once, the picture uploads to the chosen host, then the ticked sites open (all by default). Untick some in the ▾ menu: only those open, also from the Share tab. Pressing it again without changes reuses the upload.
1. *Crop RIS* (Shift+C): drag a box over part of the picture; only that part is uploaded and searched. Esc cancels.
1. Remove background from the picture (nothing selected) and from a pasted image layer.
1. *Copy image & post to Reddit*: the Reddit image form opens with `[Round N] title`, CTRL+V attaches the picture.
1. On a phone: *Share image…* opens the share sheet with the picture; pick Reddit, the title is on the clipboard. Same from a locally saved round in *Rounds*. On a browser that can't share files the button is hidden.
1. Upload with each host (Imgur, ImgBB with a key, Litterbox), then Copy, Check RIS, Submit, Save round, Copy YML. Insert shows the subreddit field.
2. *Rounds* (header): save with title and answer, kept in this browser and uploaded; save from URL. In *Saved rounds*: search, filter, show answers, open one, step with ← →, edit title/answer, post, Check RIS (a local round gets uploaded), upload, open in editor, download, delete.
2. Right-click the picture: every menu item works and Escape closes it. CTRL+C right after moving a slider copies the picture.

## Sessions and settings

1. Reload with work open: the restore banner appears and Restore brings everything back, local pictures included.
2. Save, load, duplicate and delete a named session. Export the session JSON and import it again.
3. Switch between the built-in themes, import and delete a JSON theme.
4. Remap a shortcut and reset it. Shortcuts must not fire while typing in a field.
5. Change the brush size, colour and type, the eraser mode, the region shape and the export preset, then reload: they are all kept.

## Mobile / compact layout

1. Narrow the window below 820px: picture on top, tool strip, one panel at a time, tab bar at the bottom.
2. Pinch zoom and two-finger pan on a touch device.

## Previous version

1. `old/v2/` still loads and works.
