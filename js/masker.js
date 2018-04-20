var baseImage = null;
var maskImage = null;
var height, width;
var mask = null;
var realCanvas = new fabric.Canvas("realCanvas");
document.getElementById('container').style.display = "none";



$("html").on("paste",function(event){
  if(event.originalEvent.clipboardData){
    var items = event.originalEvent.clipboardData.items;
    if (items) {
      for (index in items) {
        var item = items[index];
        if (item.kind === 'file') {
          var blob = item.getAsFile();
          var source = URL.createObjectURL(blob);
          loadSourceImage(source, false);
          return;
        } else if (item.kind === 'string') {
            if(item.type == "text/plain") {
              item.getAsString(function (s){
              document.getElementById('original').value = s;
              checkURL(s);
            });
          }
        }
      }
    }
  }
});

function addProxyToUrl(baseUrl) {
  return url = "https://cors-anywhere.herokuapp.com/" + baseUrl.replace(/(^\w+:|^)\/\//, '');
}

function checkURL(url) {
  if(url.match(/\.(jpeg|jpg|png)/) != null) {
    loadSourceImage(url, true);
  }
}

function requiresResize(id, md) {
  if (id > md)
    return true;
  else
    return false;
}

function updatePreview() {
  var image = document.getElementById('imagePreview');
  realCanvas.renderAll();
  image.src = realCanvas.toDataURL('image/jpeg', 1.0);
  if(realCanvas.width > realCanvas.height) {
    image.width = 700;
  } else {
    image.height = 700;
  }
}

function uploadImage(e) {
  var filetype = e.target.files[0].type;
  url = URL.createObjectURL(e.target.files[0]);
  if (filetype == "image/png" || filetype == "image/jpeg") {
    loadSourceImage(url, false);
  }
}

function loadSourceImage(baseUrl, externalImage) {
  if (externalImage == true) {
    sourceImageUrl = addProxyToUrl(baseUrl);
    fabric.util.loadImage(sourceImageUrl, function(_baseImage) {
      if (_baseImage == null) {
        alert("Something went wrong while loading the image.");
      }
      baseImage = _baseImage;
      height = _baseImage.height;
      width = _baseImage.width;
      realCanvas.setHeight(height).setWidth(width);
      realCanvas.setBackgroundImage(new fabric.Image(_baseImage), realCanvas.renderAll.bind(realCanvas), {
          width: width,
          height: height
      });
      updatePreview();
    }, null, "Anonymous");
  } else {
      sourceImageUrl = baseUrl;
      fabric.Image.fromURL(sourceImageUrl, function(img) {
      baseImage = img;
      height = img.height;
      width = img.width;
      realCanvas.setHeight(height).setWidth(width);
      realCanvas.setBackgroundImage(img, realCanvas.renderAll.bind(realCanvas), {
          width: width,
          height: height
      });
      updatePreview();
    });
  }
  document.getElementById('uploader').style.display = "none";
  document.getElementById('container').style.display = "grid";
}

// if (document.getElementById('original').value != '') {
//   loadSourceImage(document.getElementById('original').value, true);
// }

function loadMask(selectedMask) {
  var url = "";
  if ('target' in selectedMask) {
    var filetype = selectedMask.target.files[0].type;
    url = URL.createObjectURL(selectedMask.target.files[0]);
    if (filetype != "image/png") {
      return;
    }
  } else {
    url = selectedMask.src;
  }

  alpha = document.getElementById('alpha').value / 100;

  if (maskImage) {
    realCanvas.remove(maskImage);
  }

  fabric.Image.fromURL(url, function(img) {
    img.set('opacity', alpha);
    maskImage = img;
    if (requiresResize(width, img.width)) {
      maskImage.set('scaleX', realCanvas.width / img.width);
    }
    if(requiresResize(height, img.height)) {
      maskImage.set('scaleY', realCanvas.height / img.height);
    }
    realCanvas.add(maskImage);
    updatePreview();
  });

  document.getElementById('uploadbutton').style.display = "inline-block";
  document.getElementById('uploadbutton').value = "Upload to Imgur";
  document.getElementById('uploadbutton').disabled = false;
  document.getElementById('uploadedUrl').style.display = "none";
  document.getElementById('copyToClipboard').style.display = "none";
  document.getElementById('checkForRIS').style.display = "none";
  updatePreview();
}

function upload() {
  var img = document.getElementById('realCanvas').toDataURL('image/jpeg', 1.0).split(',')[1];

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