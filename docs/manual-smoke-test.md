# Manual Smoke Test (v3)

Lightweight browser checklist after larger changes. Serve the repository over HTTP
(`python -m http.server 8000`), open `http://localhost:8000/` and keep the DevTools console open.

## Shaders

1. Open `dev/effect-sheet.html`. No red error text, every tile shows a picture.

## Loading

1. Load an image by clicking the canvas, by drag and drop, by pasting an image and by pasting / typing an image URL.
2. With a picture loaded, paste another image: it becomes a layer. Turn off "Paste as new layer" and paste again: it replaces the base picture and the masks stay.

## Masks

1. Click several effect masks in a row: each click swaps the effect. Shift+click stacks a second one.
2. Move the sliders, press Gentle, Strong, Shuffle and Reset; Gentle/Strong must keep a custom pane size. Undo and redo each.
2. Select Swirl or Fisheye, drag the ⊕ centre, then Reset centre.
2. Pattern overlay: background transparent by default; Density adds repeats without thickening lines.
3. "Limit to a region", move / resize / rotate the region, change shape, soft edge, magnify, reflect. "Apply to whole picture".
4. Add a pattern overlay, a classic mask, a flag mask and a custom URL mask. Change opacity, zoom, angle, blend mode, hue, invert, blur, noise, warp, tile.

## Tools

1. Brush with each brush type, then erase part of a stroke.
2. Blur brush (G), pixel brush (X) and effect brush (Shift+G); change the amount slider; erase part of the painted area with the painted layer selected.
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
1. Remove background from the picture (nothing selected) and from a pasted image layer.
1. *Copy image & post to Reddit*: the Reddit image form opens with `[Round N] title`, CTRL+V attaches the picture.
1. Upload with each host (Imgur, ImgBB with a key, Litterbox), then Copy, Check RIS, Submit, Save round, Copy YML. Insert shows the subreddit field.
2. Saved rounds: browse with the arrows and the left/right keys, update, delete, save from URL.

## Sessions and settings

1. Reload with work open: the restore banner appears and Restore brings everything back, local pictures included.
2. Save, load, duplicate and delete a named session. Export the session JSON and import it again.
3. Switch between the built-in themes, import and delete a JSON theme.
4. Remap a shortcut and reset it. Shortcuts must not fire while typing in a field.

## Mobile / compact layout

1. Narrow the window below 820px: picture on top, tool strip, one panel at a time, tab bar at the bottom.
2. Pinch zoom and two-finger pan on a touch device.

## Previous version

1. `old/v2/` still loads and works.
