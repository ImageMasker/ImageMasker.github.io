# [ImageMasker.github.io](https://imageMasker.github.io)

### Image masker for /r/PictureGame

ImageMasker can load images in different ways:
* Clicking a button and selecting a file
* Drag and drop anywhere in the screen
* Paste the image directly (CTRL+V): you can paste an image from your clipboard (like a screenshot) or a URL

Once the image is loaded, it will be displayed on a canvas. You can doodle on the canvas and add masks.
Masks are slightly rotated and distorted to prevent other people from demasking them easily.
There are a few default masks that you can choose, but you can also add your own masks and they will be saved in the browser. When adding a custom mask, try to drag and drop the URL into the text input or write it manually, if you paste it, it will be used as the image on the canvas.
You can set the opacity of the mask and change its zoom. You can also change the color and size of the brush.
If you want to change the image you don't need to reload, just paste a different image and it will replace the old image.

After you're done masking, everything's ready to upload the final image! Press "Upload to Imgur" and the image will be uploaded. The upload button will disappear and you will see these new options in the menu:
* Text input with the Imgur URL for the image
* "Copy" button that will copy the link to your clipboard.
* "Check RIS" button: It will open 4 new tabs to check reverse image search on Yandex, Tineye, Google and Bing. Make sure that your browser doesn't block the popups. If they were blocked you'll see an alert.
* "Round title" and "Round Answer" text inputs. These are optional, they will be used for the "Save round" and "Submit" features.
* "Submit to /r/PictureGame" button: This button will call the picturegame.co API to get the round number and create a link with the round submission. A new tab will be opened, and if you're approved to post on /r/PictureGame you'll see that the URL for the image and the round title (if you set a title) will be already filled in, so all you need to do is submit the post!
* "Save Round" button: this button will save the image link, the title and the answer to the localstorage of your browser. Saved rounds will be available through the main screen of the site. Just press "saved rounds" and you will see your rounds ready to be submitted to /r/PictureGame.

The site also has a dark/light theme switch on the top right, your choice will be saved in the localstorage of your browser.


Possible issues:
* On displays that aren't 16:9 (like mobile devices or 4:3 monitors) there might be problems with the layout of the site
* The size and quality of the output image depends on the zoom of the browser (why?) - If the zoom is less than 100% the output image will be larger. Example: For a 80% zoom, the output seems to be ~148% of the original size. However, this doesn't seem to happen for zoom levels over 100%. It only seems to happen with images pasted from the clipboard, not links (why?? It should be exactly the same for both)
* The "on paste" listener is always on for the entire site, which is good, but it can be a problem if the user wants to add a custom mask. 
