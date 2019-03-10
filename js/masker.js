var maskImage = null;
var canvasHeight, canvasWidth;
var imgHeight, imgWidth;
var mask = null;
var canvas = new fabric.Canvas(document.getElementById('canvas'), {
  isDrawingMode: true
});
document.getElementById('container').style.display = "none";


canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
canvas.freeDrawingBrush.width = 10;

$("html").on("paste", function (event) {
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
});

function addProxyToUrl(baseUrl) {
  return url = "https://cors-anywhere.herokuapp.com/" + baseUrl.replace(/(^\w+:|^)\/\//, '');
}

function checkURL(url) {
  if (url.match(/\.(jpeg|jpg|png)/) != null) {
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

function loadSourceImage(baseUrl, externalImage) {

  var resizeFactor = Math.random() * 0.1 + 0.9;
  if (externalImage == true) {
    sourceImageUrl = addProxyToUrl(baseUrl);
    fabric.util.loadImage(sourceImageUrl, function (img) {
      if (img == null) {
        alert("Something went wrong while loading the image.");
      }
      canvasHeight = img.height * resizeFactor;
      canvasWidth = img.width * resizeFactor;
      imgHeight = img.height;
      imgWidth = img.width;

      canvas.setHeight(canvasHeight).setWidth(canvasWidth);

      if (img.height > img.width) {
        canvas.setWidth(canvasWidth * 800 / img.height);
        canvas.setHeight(canvasHeight * 800 / img.height);
      } else {
        canvas.setWidth(canvas.width * 1100 / img.width);
        canvas.setHeight(canvas.height * 1100 / img.width);
      }


      canvas.setBackgroundImage(new fabric.Image(img), canvas.renderAll.bind(canvas), {
        scaleX: canvas.width / img.width,
        scaleY: canvas.height / img.height
      });
    }, null, "Anonymous");
  } else {
    sourceImageUrl = baseUrl;
    fabric.Image.fromURL(sourceImageUrl, function (img) {
      canvasHeight = img.height * resizeFactor;
      canvasWidth = img.width * resizeFactor;
      imgHeight = img.height;
      imgWidth = img.width;
      canvas.setHeight(canvasHeight).setWidth(canvasWidth);

      if (img.height > img.width) {
        canvas.setWidth(canvasWidth * 800 / img.height);
        canvas.setHeight(canvasHeight * 800 / img.height);
      } else {
        canvas.setWidth(canvas.width * 1100 / img.width);
        canvas.setHeight(canvas.height * 1100 / img.width);
      }

      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        scaleX: canvas.width / img.width,
        scaleY: canvas.height / img.height
      });
    });
  }
  document.getElementById('uploader').style.display = "none";
  document.getElementById('mobilePaste').style.display = "none";
  document.getElementById('container').style.display = "grid";
  document.getElementById('uploadbutton').style.display = "block";
  document.getElementById('uploadbutton').style.visibility = "visible";
  //document.getElementById('myMasks').style.display = "grid";
  document.getElementById('savedRounds').style.display = "none";
  document.getElementById('displayRounds').style.display = "none";
}

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
    canvas.remove(maskImage);
  }

  new fabric.Image.fromURL(url, function (mask) {
    mask.set('opacity', alpha);
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
    maskImage.set('scaleX', 0.25 * Math.pow(Math.E, 0.0277 * slider.value));
    maskImage.set('scaleY', 0.25 * Math.pow(Math.E, 0.0277 * slider.value));

    maskImage.rotate(Math.random() * 4 - 2);
    maskImage.set({ transformMatrix: [1, Math.random() / 5, Math.random() / 5, 1, 0, 0] });
    maskImage.set('originX', 'center');
    maskImage.set('originY', 'center');
    maskImage.set('top', canvas.height / 2);
    maskImage.set('left', canvas.width / 2);
    canvas.add(maskImage);
  });
  
  document.getElementById('uploadbutton').disabled = false;
  //it would be better to use a class and hide them in one line
  //Update: this isn't even necessary
  /*document.getElementById('uploadbutton').value = "Upload to Imgur";
  document.getElementById('uploadbutton').disabled = false;
  document.getElementById('uploadedUrl').style.display = "none";
  document.getElementById('copyToClipboard').style.display = "none";
  document.getElementById('checkForRIS').style.display = "none";
  document.getElementById('PostReddit').style.display = "none";
  document.getElementById('roundTitle').style.display = "none";
  document.getElementById('roundAnswer').style.display = "none";
  document.getElementById('Save').style.display = "none";
  document.getElementById('savedRounds').style.display = "none";
  document.getElementById('displayRounds').style.display = "none";*/
}

function upload() {
  document.getElementById('canvasDiv').style.display = "none";
  //canvas.isDrawingMode = false;
  document.getElementById('previewImage').style.display = "block";
  updatePreview();
  if (imgHeight > imgWidth) {
    canvas.setZoom(imgHeight / 800);
    canvas.setWidth(canvas.width * imgHeight / 800);
    canvas.setHeight(canvas.height * imgHeight / 800);
  } else {
    canvas.setZoom(imgWidth / 1100);
    canvas.setWidth(canvas.width * imgWidth / 1100);
    canvas.setHeight(canvas.height * imgWidth / 1100);
  }

  setTimeout(imgurUpload, 250);
  function imgurUpload() {

    var img = document.getElementById('canvas').toDataURL('image/jpeg', 1.0).split(',')[1];

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
  //"Fix" extra popups getting blocked
  var url = document.getElementById("uploadedUrl").value;
  window.open("https://www.yandex.com/images/search?rpt=imageview&img_url=" + url);
  window.open("http://www.tineye.com/search/?url=" + url);
  window.open("http://www.google.com/searchbyimage?image_url=" + url);
  window.open("https://www.bing.com/images/searchbyimage?cbir=ssbi&imgurl=" + url);
  
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
  var text = document.getElementById("zoomSliderValue");
  var slider = document.getElementById("zoom");
  maskImage.set('scaleX', 0.25 * Math.pow(Math.E, 0.0277 * slider.value));
  maskImage.set('scaleY', 0.25 * Math.pow(Math.E, 0.0277 * slider.value));
  canvas.renderAll();
}

function brushSize() {
  var brushSize = document.getElementById("brushSize");
  canvas.freeDrawingBrush.width = brushSize.value;
}

function colorSelect() {
  var color = document.getElementById("colorSelect");
  canvas.freeDrawingBrush.color = color.value;
}

function postReddit(i) {
  var request = new XMLHttpRequest();
  request.open("GET", "https://api.picturegame.co/current", true);
  request.onload = () => {
    var text = request.responseText
    var i = text.search("roundNumber\":");
    var roundNumber = text.substr(i + 13, 5);
    var nextRound = parseInt(roundNumber) + 1;
    var round = "[Round " + nextRound + "] ";
    if (i == 2) {
      var imageLink = document.getElementById("uploadedUrl").value;
      var roundTitle = document.getElementById("roundTitle").value;
    } else {
      var imageLink = document.getElementById("displayedImage").src;
      var roundTitle = document.getElementById("displayedTitle").value;
    }
    var redditLink = "http://www.reddit.com/r/picturegame/submit?url=" + imageLink + "&title=" + round + roundTitle;
    window.open(redditLink);
  }
  request.send();

}

function saveImage() {
  //Maybe I should use objects instead of saving it as three items in localstorage
  var imageURL = document.getElementById("uploadedUrl").value;
  var roundTitle = document.getElementById("roundTitle").value;
  var roundAnswer = document.getElementById("roundAnswer").value;

  if (localStorage.getItem('images') == null || localStorage.getItem('images') == "") {
    localStorage.setItem('images', imageURL);
    localStorage.setItem('titles', roundTitle);
    localStorage.setItem('answers', roundAnswer);
  } else {
    var images = localStorage.getItem('images');
    var titles = localStorage.getItem('titles');
    var answers = localStorage.getItem('answers');
    images += ";" + imageURL;
    titles += ";" + roundTitle;
    answers += ";" + roundAnswer;
    localStorage.setItem('images', images);
    localStorage.setItem('titles', titles);
    localStorage.setItem('answers', answers);
  }
  var button = document.getElementById("Save");
  button.innerText = "Saved!";
  button.style.backgroundColor = "rgb(175, 211, 161)";
}

var i = 0;
//What a mess...
function displaySavedRounds(direction) {
  if (localStorage.getItem('images') == null || localStorage.getItem('images') == "") {
    alert("There are no saved images!");
  }
  else {
    if (direction == 1) {
      i--;
    } else if (direction == 2) {
      i++;
    } else if (direction == 0) {
      if (document.getElementById("savedRounds").style.display == "block") {
        document.getElementById("savedRounds").style.display = "none";
        return true;
      }

    }

    document.getElementById("savedRounds").style.display = "block";
    var image = document.getElementById("displayedImage");
    var images = localStorage.getItem('images');
    var imagesArray = images.split(";");
    image.src = imagesArray[i];

    var title = document.getElementById("displayedTitle");
    var titles = localStorage.getItem('titles')
    var titlesArray = titles.split(";");
    title.value = titlesArray[i];

    var answer = document.getElementById("displayedAnswer");
    var answers = localStorage.getItem('answers')
    var answersArray = answers.split(";");
    answer.value = answersArray[i];

    if (i <= 0) {
      var left = document.getElementById("left");
      //left.style.display="none";
      left.style.visibility = "hidden";
      document.getElementById("right").style.visibility = "visible";
    } else if (i > imagesArray.length - 2) {
      var right = document.getElementById("right");
      //right.style.display="none";
      right.style.visibility = "hidden";
      document.getElementById("left").style.visibility = "visible";
    } else {
      document.getElementById("left").style.visibility = "visible";
      document.getElementById("right").style.visibility = "visible";
    }

    if (imagesArray.length == 1) {
      document.getElementById("left").style.visibility = "hidden";
      document.getElementById("right").style.visibility = "hidden";
    }

  }

}


function deleteImage() {
  var images = localStorage.getItem('images');
  var imagesArray = images.split(";");

  var titles = localStorage.getItem('titles')
  var titlesArray = titles.split(";");

  var answers = localStorage.getItem('answers');
  var answersArray = answers.split(";");

  imagesArray.splice(i, 1);
  titlesArray.splice(i, 1);
  answersArray.splice(i, 1);

  listImages = imagesArray.join(";");
  listTitles = titlesArray.join(";");
  listAnswers = answersArray.join(";");

  localStorage.setItem('images', listImages);
  localStorage.setItem('titles', listTitles);
  localStorage.setItem('answers', listAnswers);

  if (imagesArray.length == 0) {
    document.getElementById("savedRounds").style.display = "none";
  } else {
    i = 0;
    displaySavedRounds(3);
  }

}
/*
function addMask(){
  var br = document.getElementById("br");
  var maskURL = document.getElementById("maskURL");
  var url = maskURL.value;
  if (url.substring(0,4) != "http"){
    url = "https://" + url;
  }
  br.insertAdjacentHTML('afterend', "<img width='145' height='145' src=\"" + url + "\" onclick='loadMask(this)' />")

}*/