var maskImage = null;
var canvasHeight, canvasWidth;
var imgHeight, imgWidth;
var mask = null;
var data_url;
var canvas = new fabric.Canvas('canvas', {
  isDrawingMode: true,
  enableRetinaScaling: false
});

var uploadArea = document.getElementById('uploader');
uploadArea.ondragover = function (e) { e.preventDefault() }
uploadArea.ondrop = function (e) { e.preventDefault(); uploadDragnDrop(e.dataTransfer.files[0]); }

canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
canvas.freeDrawingBrush.width = 10;
fabric.textureSize = 4096;

$("html").on("paste", function (event) {
  if (event.target.id === 'customMaskURL' || event.target.id === 'saveFromURLURL') { }
  else if (event.target.id === 'mobileRISURL') {

    var items = event.originalEvent.clipboardData.items;
    var item = items[0];
    item.getAsString(function (s) {
      window.open("http://www.tineye.com/search/?url=" + s);
      window.open("http://www.google.com/searchbyimage?image_url=" + s);
      window.open("https://yandex.com/images/search?url=" + s + "&rpt=imageview");
      window.open("https://www.bing.com/images/searchbyimage?cbir=ssbi&imgurl=" + s);
    });
  }
  else {
    if (event.originalEvent.clipboardData) {
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
            if (item.type == "text/plain") {
              item.getAsString(function (s) {
                checkURL(s);
              });
            }
          }
        }
      }
    }
  }
});

function addProxyToUrl(baseUrl) {
  return url = "https://cors.bridged.cc/" + baseUrl.replace(/(^\w+:|^)\/\//, '');
}

function checkURL(url) {
  if (url.match(/\.(jpeg|jpg|png|gif)/) != null) {
    loadSourceImage(url, true);
  }
}

function requiresResize(id, md) {
  if (1.3 * id > md)
    return true;
  else
    return false;
}

function requiresMinimize(id, md) {
  if (4 * id < md)
    return true;
  else
    return false;
}

function updatePreview() {
  var image = document.getElementById('imagePreview');
  canvas.renderAll();
  image.src = canvas.toDataURL('image/jpeg', 1.0);
}

function uploadImage(e) {
  var filetype = e.target.files[0].type;
  url = URL.createObjectURL(e.target.files[0]);
  if (filetype == "image/png" || filetype == "image/jpeg") {
    loadSourceImage(url, false);
  }
}

function uploadDragnDrop(file) {
  var url = URL.createObjectURL(file);
  loadSourceImage(url, false);
  //it doesn't check, if the file is an image, 
  //but I'll just assume they know they are uploading an image...
}

function loadSourceImage(baseUrl, externalImage) {

  var resizeFactor = Math.random() * 0.05 + 0.95;
  if (externalImage == true) {
    sourceImageUrl = addProxyToUrl(baseUrl);
    fabric.util.loadImage(sourceImageUrl, function (img) {
      if (img == null) {
        alert("Something went wrong while loading the image.");
      }
      imgHeight = img.height * resizeFactor;
      imgWidth = img.width * resizeFactor;

      if (img.height > img.width) {
        canvas.setWidth((img.width * 800) / img.height);
        canvas.setHeight(800);
      } else {
        canvas.setWidth(1100);
        canvas.setHeight((img.height * 1100) / img.width);
      }

      canvas.setBackgroundImage(new fabric.Image(img), canvas.renderAll.bind(canvas), {
        scaleX: canvas.width / img.width,
        scaleY: canvas.height / img.height
      });
    }, null, "Anonymous");
  } else {
    sourceImageUrl = baseUrl;
    fabric.Image.fromURL(sourceImageUrl, function (img) {
      imgHeight = img.height * resizeFactor;
      imgWidth = img.width * resizeFactor;

      if (img.height > img.width) {
        canvas.setWidth((img.width * 800) / img.height);
        canvas.setHeight(800);
      } else {
        canvas.setWidth(1100);
        canvas.setHeight((img.height * 1100) / img.width);
      }

      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        scaleX: canvas.width / img.width,
        scaleY: canvas.height / img.height
      });
    });
  }
  document.getElementById('uploader').style.display = "none";
  document.getElementById('mobilePaste').style.display = "none";
  document.getElementById('mobileRIS').style.display = "none";

  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    document.getElementById('container').style.display = "block";
  } else {
    document.getElementById('container').style.display = "grid";
  }
  document.getElementById('uploadbutton').style.display = "inline-block";
  document.getElementById('uploadbutton').style.visibility = "visible";
  document.getElementById('Download').style.visibility = "inline-block";
  document.getElementById('Download').style.visibility = "visible";
  document.getElementById('savedRounds').style.display = "none";
  document.getElementById('displayRounds').style.display = "none";
  document.getElementById('saveFromURL').style.display = "none";
  document.getElementById('night').style.display = "none";
  document.getElementById('github').style.display = "none";
}

function loadMask(selectedMask, alphaValue, origin,zoom, deform) {
  if(origin == "country"){
    url = selectedMask;
  }else{
    thumbURL = selectedMask.src;
    var url = thumbURL.replace("_thumb", "");
  }


  alpha = alphaValue / 100;
  document.getElementById("alpha").value = alphaValue;
  document.getElementById("sliderValue").innerText = alphaValue;
  //alpha = document.getElementById('alpha').value / 100;

  if (maskImage) {
    canvas.remove(maskImage);
  }

  new fabric.Image.fromURL(url, function (mask) {
    mask.set({
      id: 'mask',
      opacity: alpha
    });
    maskImage = mask;
    var slider = document.getElementById("zoom");
    if (requiresResize(canvasWidth, mask.width)) {
      slider.value = 70;
    }
    if (requiresResize(canvasHeight, mask.height)) {
      slider.value = 70;
    }
    if (requiresMinimize(canvasWidth, mask.width) || requiresMinimize(canvasHeight, mask.height)) {
      slider.value = 40;
    }
    if(zoom != null){
      slider.value = zoom;
    }
    maskImage.set('scaleX', 0.25 * Math.pow(Math.E, 0.0277 * slider.value));
    maskImage.set('scaleY', 0.25 * Math.pow(Math.E, 0.0277 * slider.value));

    if(deform != false){
      maskImage.rotate(Math.random() * 4 - 2);
      maskImage.set({ transformMatrix: [1, (Math.random() / 5) - 0.1, (Math.random() / 5) - 0.1, 1, 0, 0] });
    }

    maskImage.set('originX', 'center');
    maskImage.set('originY', 'center');
    maskImage.set('top', canvas.height / 2);
    maskImage.set('left', canvas.width / 2);
    canvas.add(maskImage);
  }, { crossOrigin: 'Anonymous' });

  document.getElementById('uploadbutton').disabled = false;
}

function upload() {
  document.getElementById('canvasDiv').style.display = "none";
  document.getElementById('previewImage').style.display = "block";
  updatePreview();
  if (imgHeight > imgWidth) {
    canvas.setZoom(imgHeight / 800);
    canvas.setWidth(imgWidth);
    canvas.setHeight(imgHeight);
  } else {
    canvas.setZoom(imgWidth / 1100);
    canvas.setWidth(imgWidth);
    canvas.setHeight(imgHeight);
  }

  setTimeout(imgurUpload, 250);
  function imgurUpload() {
    var format = 'image/jpeg';
    data_url = canvas.toDataURL("image/png");
    var head = 'data:image/png;base64,';
    var imgFileSize = Math.round((data_url.length - head.length) * 3 / 4);
    if (imgFileSize < 3000000) {
      format = 'image/png';
    }

    var img = document.getElementById('canvas').toDataURL(format, 1.0).split(',')[1];

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
      error: function (response) {
        alert("Error uploading to Imgur. Reason: " + response.responseJSON.data.error);
        document.getElementById('uploadbutton').value = "Upload to Imgur";
        document.getElementById('uploadbutton').disabled = false;
      },
      success: function (response) {
        if (response.success) {
          document.getElementById('uploadedUrl').value = response.data.link;
          document.getElementById('uploadbutton').style.display = "none";
          document.getElementById('uploadedUrl').style.display = "inline-block";
          document.getElementById('copyToClipboard').style.display = "inline-block";
          document.getElementById('checkForRIS').style.display = "inline-block";
          document.getElementById('PostReddit').style.display = "inline-block";
          document.getElementById('roundTitle').style.display = "inline-block";
          document.getElementById('roundAnswer').style.display = "inline-block";
          document.getElementById('Save').style.display = "inline-block";
          document.getElementById('Download').style.display = "inline-block";
        } else {
          alert("Failed to upload.");
        }
      }
    });
    document.getElementById('uploadbutton').value = "Uploading...";
    document.getElementById('uploadbutton').disabled = true;
  }
}

function copyUrl() {
  var copyText = document.getElementById("uploadedUrl");
  copyText.select();
  document.execCommand("Copy");
}

function checkRIS() {
  var url = document.getElementById("uploadedUrl").value;
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    setTimeout(function () { window.open("https://yandex.com/images/search?url=" + url + "&rpt=imageview") }, 2000);
    setTimeout(function () { window.open("http://www.tineye.com/search/?url=" + url) }, 2000);
    setTimeout(function () { window.open("http://www.google.com/searchbyimage?image_url=" + url) }, 2000);
    setTimeout(function () { window.open("https://www.bing.com/images/searchbyimage?cbir=ssbi&imgurl=" + url) }, 2000);
  } else {
    window.open("https://yandex.com/images/search?url=" + url + "&rpt=imageview");
    var popUp = window.open("http://www.tineye.com/search/?url=" + url);
    if (popUp == null || typeof (popUp) == 'undefined') {
      alert('The other RIS sites were blocked by the browser. Please allow popups for this site.');
    }
    else {
      popUp.focus();
    }
    window.open("https://www.bing.com/images/searchbyimage?cbir=ssbi&imgurl=" + url);
    window.open("http://www.google.com/searchbyimage?image_url=" + url);
  }


  document.getElementById("previewImage").style.display = "none";
  if (imgHeight > imgWidth) {
    canvas.setZoom(1);
    canvas.setWidth(canvas.width * 800 / imgHeight);
    canvas.setHeight(canvas.height * 800 / imgHeight);
  } else {
    canvas.setZoom(1);
    canvas.setWidth(canvas.width * (1100 / imgWidth));
    canvas.setHeight(canvas.height * (1100 / imgWidth));
  }
  document.getElementById('canvasDiv').style.display = "block";
  document.getElementById('uploadbutton').style.display = "block";
  document.getElementById('uploadbutton').disabled = false;
  document.getElementById('uploadbutton').value = "Reupload";
}

function updateOpacity() {
  var text = document.getElementById("sliderValue");
  var slider = document.getElementById("alpha");
  text.innerText = slider.value;
  maskImage.set('opacity', slider.value / 100);
  canvas.renderAll();
}

function updateZoomer() {
  var slider = document.getElementById("zoom");
  maskImage.set('scaleX', 0.25 * Math.pow(Math.E, 0.0277 * slider.value));
  maskImage.set('scaleY', 0.25 * Math.pow(Math.E, 0.0277 * slider.value));
  canvas.renderAll();
}

/*function brushSize() {
  var brushSize = document.getElementById("brushSize");
  canvas.freeDrawingBrush.width = brushSize.value;
}*/

$(document).on('input', '#brushSize', function () {
  canvas.freeDrawingBrush.width = parseInt($(this).val());
});
/*var drawingLineWidthEl = $('brushSize');
if (canvas.freeDrawingBrush) {
  canvas.freeDrawingBrush.width = parseInt(drawingLineWidthEl.value, 10) || 1;
};
drawingLineWidthEl.onchange = function() {
  canvas.freeDrawingBrush.width = drawingLineWidthEl.value;
};*/

function colorSelect() {
  var color = document.getElementById("colorSelect");
  canvas.freeDrawingBrush.color = color.value;
}

function postReddit(index, subreddit) {
  var request = new XMLHttpRequest();
  request.open("GET", "https://api.picturegame.co/current", true);
  request.onload = () => {
    var text = request.responseText
    var i = text.search("roundNumber\":");
    var roundNumber = text.substr(i + 13, 5);
    var nextRound = parseInt(roundNumber) + 1;
    var round = "[Round " + nextRound + "] ";
    if (index == 2) {
      var imageLink = document.getElementById("uploadedUrl").value;
      var roundTitle = document.getElementById("roundTitle").value;
    } else {
      var imageLink = document.getElementById("displayedImage").src;
      var roundTitle = document.getElementById("displayedTitle").value;
    }
    roundTitle = encodeURIComponent(roundTitle);
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      redditURL = "http://old.reddit.com/r/";
    } else {
      redditURL = "http://www.reddit.com/r/";
    }
    var redditLink = redditURL + subreddit + "/submit?url=" + imageLink + "&title=" + round + roundTitle;
    window.open(redditLink);
  }
  request.send();

}

function saveImage(mode) {

  if (mode == 1) {
    var imageURL = document.getElementById("uploadedUrl").value;
    var roundTitle = document.getElementById("roundTitle").value;
    var roundAnswer = document.getElementById("roundAnswer").value;
  } else{
    var imageURL = document.getElementById("saveFromURLURL").value;
    var roundTitle = document.getElementById("saveFromURLTitle").value;
    var roundAnswer = document.getElementById("saveFromURLAnswer").value;
  }

  roundData = [imageURL, roundTitle, roundAnswer];

  if (JSON.parse(localStorage.getItem('rounds')) == null || JSON.parse(localStorage.getItem('rounds')) == "") {
    localStorage.setItem('rounds', JSON.stringify([roundData]));
  }
  else {
    var previousRoundData = JSON.parse(localStorage.getItem('rounds'));
    previousRoundData.push(roundData);
    localStorage.setItem('rounds', JSON.stringify(previousRoundData));
  }
  var saveElement = mode==1 ? "Save" : "saveExternal";
  var button = document.getElementById(saveElement);
  button.innerText = "Saved!";
  button.style.backgroundColor = "rgb(175, 211, 161)";
}

function downloadImage() {
  var downloadLink = document.createElement('a');
  downloadLink.href = canvas.toDataURL("image/png").replace("image/png");
  var d = new Date();
  var formattedDate = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + " " + d.getHours() + "-" + d.getMinutes();
  downloadLink.download = 'round ' + formattedDate + '.png';

  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

var i = 0;
//What a mess...
function displaySavedRounds(direction) {
  if (JSON.parse(localStorage.getItem('rounds')) == null || JSON.parse(localStorage.getItem('rounds')) == "") {
    alert("There are no saved images!");
    return true;
  }
  else {
    if (direction == 1) {
      i--;
    } else if (direction == 2) {
      i++;
    } else if (direction == 0) { 
      i = 0;
      if (document.getElementById("savedRounds").style.display == "block") {
        document.getElementById("savedRounds").style.display = "none";
        document.getElementById('saveFromURL').style.display = "block";
        return true;
      } else{ 
        setTimeout(function(){
          window.scrollTo(0,document.body.scrollHeight);
      }, 100);
      }

    }
    document.getElementById('saveFromURL').style.display = "none";
    var rounds = JSON.parse(localStorage.getItem('rounds'));


    document.getElementById("savedRounds").style.display = "block";

    var imageLink = document.getElementById("displayedImagelink");
    imageLink.setAttribute('href', rounds[i][0]);

    var image = document.getElementById("displayedImage");
    image.src = rounds[i][0];

    var title = document.getElementById("displayedTitle");
    title.value = rounds[i][1];

    var answer = document.getElementById("displayedAnswer");
    answer.value = rounds[i][2];

    if (i <= 0) {
      var left = document.getElementById("left");
      //left.style.display="none";
      left.style.visibility = "hidden";
      document.getElementById("right").style.visibility = "visible";
    } else if (i > rounds.length - 2) {
      var right = document.getElementById("right");
      //right.style.display="none";
      right.style.visibility = "hidden";
      document.getElementById("left").style.visibility = "visible";
    } else {
      document.getElementById("left").style.visibility = "visible";
      document.getElementById("right").style.visibility = "visible";
    }

    if (rounds.length == 1) {
      document.getElementById("left").style.visibility = "hidden";
      document.getElementById("right").style.visibility = "hidden";
    }

  }

}


function deleteImage() {
  if (window.confirm("Are you sure you want to delete the round?")) {
    var rounds = JSON.parse(localStorage.getItem('rounds'));
    roundsAfter = rounds.slice(0, i).concat(rounds.slice(i + 1, rounds.length))
    localStorage.setItem('rounds', JSON.stringify(roundsAfter));

    if (roundsAfter.length == 0) {
      document.getElementById("savedRounds").style.display = "none";
      document.getElementById('saveFromURL').style.display = "block";

    } else {
      i = 0;
      displaySavedRounds(3);
    }
  }

}

function addMask() {
  var br = document.getElementById("br");
  var uploadedMask = document.getElementById("customMaskURL").value;
  br.insertAdjacentHTML('beforeBegin', "<img width='95' height='95' class=\"myMasks\" src=\"" + uploadedMask + "\" onclick='loadMask(this,60)' /> ")

  if (localStorage.getItem('masks') == null || localStorage.getItem('masks') == "") {
    localStorage.setItem('masks', uploadedMask);
  } else {
    var masks = localStorage.getItem('masks');
    masks += ";" + uploadedMask;
    localStorage.setItem('masks', masks);
  }
}

function clearMasks() {
  var removedMasks = document.getElementsByClassName("myMasks");
  for (i = 0; i < removedMasks.length; i++) {
    removedMasks[i].style.display = "none";
  }
  localStorage.removeItem("masks");
}

function undo() {
  if (canvas._objects.length > 0) {
    canvas._objects.pop();
    canvas.renderAll();
  }
}

var filters = ['grayscale', 'invert', 'remove-color', 'sepia', 'brownie',
  'brightness', 'contrast', 'saturation', 'noise', 'vintage',
  'pixelate', 'blur', 'sharpen', 'emboss', 'technicolor',
  'polaroid', 'blend-color', 'gamma', 'kodachrome',
  'blackwhite', 'blend-image', 'hue', 'resize'];

$("#invert").click(function () {
  //alert("beep boop");
  ObjectName = 'mask';
  function selectObject(ObjectName) {
    canvas.getObjects().forEach(function (o) {
      if (o.id === ObjectName) {
        canvas.setActiveObject(o);
      }
    })
  }
  selectObject(ObjectName);
  var object = canvas.getActiveObject();
  var filter = new fabric.Image.filters.Invert();
  object.filters.push(filter);
  object.applyFilters();
  canvas.renderAll();
});


if (localStorage.getItem('masks') === null || localStorage.getItem('masks') === "") { } else {
  //I don't know why I have to do it like this to avoid triggering loadMasks when masks is empty
  loadMasks();
}

function loadMasks() {
  var br = document.getElementById("br");
  var savedMasks = localStorage.getItem("masks");
  var masksArray = savedMasks.split(";");
  for (i = 0; i < masksArray.length; i++) {
    br.insertAdjacentHTML('beforeBegin', "<img width='95' height='95' class=\"myMasks\" src=\"" + masksArray[i] + "\" onclick='loadMask(this,60)' /> ")
  }
}

//*****************Keyboard shortcuts *********************/
//Disable drawing mode with SHIFT, enable it again pressing SHIFT
$(document).on('keydown', function (e) {
  if (e.shiftKey) {
    if (canvas.isDrawingMode == false) {
      canvas.isDrawingMode = true;
    } else {
      canvas.isDrawingMode = false;
    }
  }
});

//undo on CTRL+Z
$(document).on('keydown', function (e) {
  if (e.ctrlKey && (e.which === 90)) {
    undo();
  }
});

var opac = 1;
//Rotate masks with left and right arrows
//Set opacity of selected object (masks or lines) with up and down arrows
//Clone object with ALT
//Press "Insert" to choose a custom subreddit

$(document).on('keydown', function (e) {
  var target = $(event.target);
  if (event.which == 37) {
    if (target.is("input")) { }
    else {
      event.preventDefault();
      if (document.getElementById("savedRounds").style.display == "block") {
        displaySavedRounds(1);
      } else {
        var originalAngle = maskImage.get('angle');
        maskImage.rotate(originalAngle - 2);
        canvas.renderAll();
      }
    }

  }
  if (event.which == 39) {
    if (target.is("input")) { }
    else {
      event.preventDefault()
      if (document.getElementById("savedRounds").style.display == "block") {
        displaySavedRounds(2);
      } else {
        var originalAngle = maskImage.get('angle');
        maskImage.rotate(originalAngle + 2);
        canvas.renderAll();
      }
    }
  }
  if (event.which == 40) {
    event.preventDefault()
    if (canvas.getActiveObject()) {
      var obj = canvas.getActiveObject();
    } else {
      var obj = canvas._objects[canvas._objects.length - 1];
    }
    if (opac > 0.1) {
      opac = opac - 0.1;
    }
    obj.set('opacity', opac);
    canvas.renderAll();
  }
  if (event.which == 38) {
    event.preventDefault()
    if (canvas.getActiveObject()) {
      var obj = canvas.getActiveObject();
    } else {
      var obj = canvas._objects[canvas._objects.length - 1];
    }
    if (opac <= 1) {
      opac = opac + 0.1;
    }
    obj.set('opacity', opac);
    canvas.renderAll();
  }
  if (event.which == 220) {
    if (canvas.getActiveObject()) {
      var obj = canvas.getActiveObject();
    } else {
      var obj = canvas._objects[canvas._objects.length - 1];
    }
    var object = fabric.util.object.clone(obj);
    object.set("top", object.top + 7);
    object.set("left", object.left + 7);
    canvas.add(object);
  }
  if (e.which === 45) {
    var newSubInput = document.getElementById('newSubInput');
    newSubInput.style.display = "inline-block";
    var newSub = newSubInput.value;
    var newPost = document.getElementById('PostReddit');
    newPost.innerText = "Post to /r/";
  }
});


function updateInfo() {
  var roundTitle = document.getElementById("displayedTitle").value
  var roundAnswer = document.getElementById("displayedAnswer").value;
  rounds = JSON.parse(localStorage.getItem('rounds'))
  rounds[i][1] = roundTitle;
  rounds[i][2] = roundAnswer;
  localStorage.setItem('rounds', JSON.stringify(rounds));
}

function displaySaveURL() {
  if (document.getElementById("displayRounds").style.display != "none") {
    document.getElementById("displayRounds").style.display = "none";
    document.getElementById("saveExternalURL").style.display = "block";
  } else {
    document.getElementById("displayRounds").style.display = "block";
    document.getElementById("saveExternalURL").style.display = "none";
  }
}




$("#country").on('change', function() {
  loadMask(this.value, 75, "country", 25, false);
});