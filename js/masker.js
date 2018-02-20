var baseImage = null;
var maskImage = null;
var fakeMaskImage = null;
var height, width, newHeight, newWidth;
var mask = null;
var realCanvas = new fabric.Canvas("realCanvas");
var fakeCanvas = new fabric.Canvas("fakeCanvas");

function addProxyToUrl(baseUrl) {
  return url = "https://cors-anywhere.herokuapp.com/" + baseUrl.replace(/(^\w+:|^)\/\//, '');
}

function checkURL(url) {
  if(url.match(/\.(jpeg|jpg|gif|png)$/) != null) {
    loadSourceImage();
  }
}

function calculateDimensions(h, w) {
  newHeight = h;
  newWidth = w;
  if (w > h) {
    if (w > 1000) {
      newHeight *= 1000/w;
      newWidth = 1000;
    }
  } else {
    if (h > 1000) {
      newWidth *= 1000/h;
      newHeight = 1000;
    }
  }
}

function requiresResize(ih, iw, mh, mw) {
  if (ih > mh || iw > mw)
    return true;
  else
    return false;
}

function loadSourceImage() {
    baseUrl = document.getElementById('original').value;
    if (baseUrl == "") {
        sourceImageUrl = "images/placeholder.png"
    } else {
        sourceImageUrl = addProxyToUrl(document.getElementById('original').value);
    }
    fabric.util.loadImage(sourceImageUrl, function(_baseImage) {
        baseImage = _baseImage;
        height = _baseImage.height;
        width = _baseImage.width;
        calculateDimensions(_baseImage.height, _baseImage.width);
        console.log(newHeight, newWidth);
        fakeCanvas.setHeight(newHeight).setWidth(newWidth);
        realCanvas.setHeight(height).setWidth(width);
        realCanvas.setBackgroundImage(new fabric.Image(_baseImage), realCanvas.renderAll.bind(realCanvas), {
            width: width,
            height: height,
            originX: 0,
            originY: 0
        });
        fakeCanvas.setBackgroundImage(new fabric.Image(_baseImage), fakeCanvas.renderAll.bind(fakeCanvas), {
          scaleX: fakeCanvas.width / width,
          scaleY: fakeCanvas.height / height
        });
    }, null, "Anonymous");
}
loadSourceImage();

function uploadMaskImage(e) {
  var filetype = e.target.files[0].type;
  var url = URL.createObjectURL(e.target.files[0]);
  alpha = document.getElementById('alpha').value / 100;

  if (filetype === "image/png") {
    if (maskImage) {
      fakeCanvas.remove(fakeMaskImage);
      realCanvas.remove(maskImage);
    }
    fabric.Image.fromURL(url, function(img) {
      maskImage = img;
      fakeMaskImage = img;
      maskImage.set({
        scaleX: realCanvas.width / img.width,
        scaleY: realCanvas.height / img.height,
        opacity: alpha
      });
      fakeMaskImage.set({
        scaleX: realCanvas.width / maskImage.width,
        scaleY: realCanvas.height / maskImage.height,
        opacity: alpha
      });
      
      fakeMaskImage = img;
      realCanvas.add(maskImage);
      fakeCanvas.add(fakeMaskImage);
    });
    document.getElementById('uploadbutton').style.display = "inline-block";
    document.getElementById('uploadbutton').value = "Upload to Imgur";
    document.getElementById('uploadbutton').disabled = false;
    document.getElementById('uploadedUrl').style.display = "none";
    document.getElementById('copyToClipboard').style.display = "none";
    document.getElementById('checkForRIS').style.display = "none";
}
}

function loadMaskImage(selectedMask) {
    alpha = document.getElementById('alpha').value / 100;
    maskImageUrl = selectedMask.src;
    fabric.util.loadImage(maskImageUrl, function(_maskImage) {
        if (maskImage) {
            fakeCanvas.remove(fakeMaskImage);
            realCanvas.remove(maskImage);
        }
        maskImage = new fabric.Image(_maskImage).set({
          opacity: alpha,
          scaleX: realCanvas.width / _maskImage.width,
          scaleY: realCanvas.height / _maskImage.height
        });
        fakeMaskImage = new fabric.Image(_maskImage).set({
          opacity: alpha,
          scaleX: realCanvas.width / maskImage.width,
          scaleY: realCanvas.height / maskImage.height,
        });
        realCanvas.add(maskImage);
        fakeCanvas.add(fakeMaskImage);
    }, null, "Anonymous");
    document.getElementById('uploadbutton').style.display = "inline-block";
    document.getElementById('uploadbutton').value = "Upload to Imgur";
    document.getElementById('uploadbutton').disabled = false;
    document.getElementById('uploadedUrl').style.display = "none";
    document.getElementById('copyToClipboard').style.display = "none";
    document.getElementById('checkForRIS').style.display = "none";
}

function upload() {
  var img = document.getElementById('realCanvas').toDataURL('image/png').split(',')[1];

  $.ajax({
      url: 'https://api.imgur.com/3/image',
      type: 'post',
      headers: {
          Authorization: 'Client-ID 9c586fafe6ec100'
      },
      data: {
          image: img
      },
      dataType: 'json',
      error: function(response) {
        alert("Error uploading to Imgur. Reason: " + response.responseJSON.data.error);
        document.getElementById('uploadbutton').value = "Upload to Imgur";
        document.getElementById('uploadbutton').disabled = false;
      },
      success: function(response) {
          if(response.success) {
              document.getElementById('uploadedUrl').value = response.data.link;
              document.getElementById('uploadbutton').style.display = "none";
              document.getElementById('uploadedUrl').style.display = "inline-block";
              document.getElementById('copyToClipboard').style.display = "inline-block";
              document.getElementById('checkForRIS').style.display = "inline-block";
          } else {
            alert("Failed to upload.");
          }
      }
  });
document.getElementById('uploadbutton').value = "Uploading...";
document.getElementById('uploadbutton').disabled = true;
}

function copyUrl() {
  var copyText = document.getElementById("uploadedUrl");
  copyText.select();
  document.execCommand("Copy");
}

function checkRIS() {
  var url = document.getElementById("uploadedUrl").value;
  window.open("http://www.google.com/searchbyimage?image_url="+url);
  window.open("https://www.bing.com/images/searchbyimage?cbir=ssbi&pageurl=http%3A%2F%2Fwww.squobble.com&imgurl="+url);
  window.open("https://www.yandex.com/images/search?rpt=imageview&img_url="+url);
  window.open("http://www.tineye.com/search/?url="+url);
}