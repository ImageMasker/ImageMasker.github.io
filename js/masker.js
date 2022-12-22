var maskImage = null;
var canvasHeight, canvasWidth;
var imgHeight, imgWidth;
var mask = null;
var canvas = new fabric.Canvas("canvas", {
  isDrawingMode: true,
  enableRetinaScaling: false,
  preserveObjectStacking: true,
});

var uploadArea = document.getElementById("uploader");
uploadArea.ondragover = function (e) {
  e.preventDefault();
};
uploadArea.ondrop = function (e) {
  e.preventDefault();
  uploadDragnDrop(e.dataTransfer.files[0]);
};

canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
canvas.freeDrawingBrush.width = 10;
canvas.freeDrawingBrush.color = hexToRgb(
  document.getElementById("colorSelect").value
);
fabric.textureSize = 4096;

$("html").on("paste", function (event) {
  if (
    event.target.id === "customMaskURL" ||
    event.target.id === "saveFromURLURL" ||
    event.target.id == "copyToClipboard"
  ) {
  } else if (event.target.id === "mobileRISURL") {
    var items = event.originalEvent.clipboardData.items;
    var item = items[0];
    item.getAsString(function (s) {
      window.open("http://www.tineye.com/search/?url=" + s);
      window.open("https://lens.google.com/uploadbyurl?url=" + s);
      window.open(
        "https://www.google.com/searchbyimage?sbisrc=cr_1_5_2&image_url=" + s
      );
      window.open(
        "https://yandex.com/images/search?url=" + s + "&rpt=imageview"
      );
      window.open(
        "https://www.bing.com/images/searchbyimage?cbir=ssbi&imgurl=" + s
      );
    });
  } else {
    if (event.originalEvent.clipboardData) {
      var items = event.originalEvent.clipboardData.items;
      if (items) {
        for (index in items) {
          var item = items[index];
          if (item.kind === "file") {
            var blob = item.getAsFile();
            var source = URL.createObjectURL(blob);
            loadSourceImage(source, false);
            return;
          } else if (item.kind === "string") {
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
  return (url =
    "https://cors.bridged.cc/" + baseUrl.replace(/(^\w+:|^)\/\//, ""));
}

function checkURL(url) {
  if (url.match(/\.(jpeg|jpg|png|gif)/) != null) {
    loadSourceImage(url, true);
  }
}

function requiresResize(id, md) {
  if (1.3 * id > md) return true;
  else return false;
}

function requiresMinimize(id, md) {
  if (4 * id < md) return true;
  else return false;
}

function updatePreview() {
  var image = document.getElementById("imagePreview");
  canvas.renderAll();
  image.src = canvas.toDataURL("image/jpeg", 1.0);
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
  //var resizeFactor = Math.random() * 0.05 + 0.95;
  var resizeFactor = 1;
  if (externalImage == true) {
    sourceImageUrl = addProxyToUrl(baseUrl);
    fabric.util.loadImage(
      sourceImageUrl,
      function (img) {
        if (img == null) {
          alert("Something went wrong while loading the image.");
        }
        imgHeight = img.height * resizeFactor;
        imgWidth = img.width * resizeFactor;

        if (img.height > img.width) {
          canvas.setWidth((img.width * 800) / img.height);
          canvas.setHeight(800);
        } else {
          canvas.setWidth(1000);
          canvas.setHeight((img.height * 1000) / img.width);
        }
        canvasHeight = canvas.getHeight();
        canvasWidth = canvas.getWidth();

        canvas.setBackgroundImage(
          new fabric.Image(img),
          canvas.renderAll.bind(canvas),
          {
            scaleX: canvas.width / img.width,
            scaleY: canvas.height / img.height,
            erasable: false,
          }
        );
      },
      null,
      "Anonymous"
    );
  } else {
    sourceImageUrl = baseUrl;
    fabric.Image.fromURL(sourceImageUrl, function (img) {
      imgHeight = img.height * resizeFactor;
      imgWidth = img.width * resizeFactor;

      if (img.height > img.width) {
        canvas.setWidth((img.width * 800) / img.height);
        canvas.setHeight(800);
      } else {
        canvas.setWidth(1000);
        canvas.setHeight((img.height * 1000) / img.width);
      }
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        scaleX: canvas.width / img.width,
        scaleY: canvas.height / img.height,
        erasable: false,
      });
      canvasHeight = canvas.getHeight();
      canvasWidth = canvas.getWidth();
    });
  }
  document.getElementById("uploader").style.display = "none";
  document.getElementById("mobilePaste").style.display = "none";
  document.getElementById("mobileRIS").style.display = "none";

  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  ) {
    document.getElementById("container").style.display = "block";
  } else {
    document.getElementById("container").style.display = "grid";
  }
  document.getElementById("uploadbutton").style.display = "inline-block";
  document.getElementById("uploadbutton").style.visibility = "visible";
  document.getElementById("Download").style.visibility = "inline-block";
  document.getElementById("Download").style.visibility = "visible";
  document.getElementById("Copy").style.visibility = "inline-block";
  document.getElementById("Copy").style.visibility = "visible";
  document.getElementById("savedRounds").style.display = "none";
  document.getElementById("displayRounds").style.display = "none";
  document.getElementById("saveFromURL").style.display = "none";
  document.getElementById("night").style.display = "none";
  document.getElementById("github").style.display = "none";
}

function loadMask(selectedMask, alphaValue, origin, zoom, deform) {
  if (origin == "country") {
    url = selectedMask;
  } else {
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

  new fabric.Image.fromURL(
    url,
    function (mask) {
      mask.set({
        id: "mask",
        opacity: alpha,
      });
      maskImage = mask;
      var slider = document.getElementById("zoom");
      if (requiresResize(canvasWidth, mask.width)) {
        slider.value = 70;
      }
      if (requiresResize(canvasHeight, mask.height)) {
        slider.value = 70;
      }
      if (
        requiresMinimize(canvasWidth, mask.width) ||
        requiresMinimize(canvasHeight, mask.height)
      ) {
        slider.value = 40;
      }
      if (zoom != null) {
        slider.value = zoom;
      }
      maskImage.set("scaleX", 0.25 * Math.pow(Math.E, 0.0277 * slider.value));
      maskImage.set("scaleY", 0.25 * Math.pow(Math.E, 0.0277 * slider.value));

      if (deform != false) {
        maskImage.rotate(Math.random() * 4 - 2);
        maskImage.set({
          transformMatrix: [
            1,
            Math.random() / 5 - 0.1,
            Math.random() / 5 - 0.1,
            1,
            0,
            0,
          ],
        });
      }

      maskImage.set("originX", "center");
      maskImage.set("originY", "center");
      maskImage.set("top", canvas.height / 2);
      maskImage.set("left", canvas.width / 2);
      canvas.add(maskImage);
    },
    { crossOrigin: "Anonymous" }
  );

  document.getElementById("uploadbutton").disabled = false;
}

function upload() {
  document.getElementById("canvasDiv").style.display = "none";
  document.getElementById("previewImage").style.display = "block";
  updatePreview();
  if (imgHeight > imgWidth) {
    canvas.setZoom(imgHeight / 800);
    canvas.setWidth(imgWidth);
    canvas.setHeight(imgHeight);
  } else {
    canvas.setZoom(imgWidth / 1000);
    canvas.setWidth(imgWidth);
    canvas.setHeight(imgHeight);
  }

  setTimeout(imgurUpload, 250);
  function imgurUpload() {
    var token = "";
    if (
      localStorage.getItem("accessToken") == null ||
      localStorage.getItem("accessToken") == ""
    ) {
      token = "Client-ID 9c586fafe6ec100";
    } else {
      token = "Bearer " + localStorage.getItem("accessToken");
    }

    var img = document
      .getElementById("canvas")
      .toDataURL("image/png", 1.0)
      .split(",")[1];

    $.ajax({
      url: "https://api.imgur.com/3/image",
      type: "post",
      headers: {
        Authorization: token,
      },
      data: {
        image: img,
      },
      dataType: "json",
      error: function (response) {
        alert(
          "Error uploading to Imgur. Reason: " +
            response.responseJSON.data.error
        );
        document.getElementById("uploadbutton").value = "Upload to Imgur";
        document.getElementById("uploadbutton").disabled = false;
        document.getElementById("canvasDiv").style.display = "block";
        document.getElementById("previewImage").style.display = "none";
        if (imgHeight > imgWidth) {
          canvas.setZoom(1);
          canvas.setWidth((canvas.width * 800) / imgHeight);
          canvas.setHeight((canvas.height * 800) / imgHeight);
        } else {
          canvas.setZoom(1);
          canvas.setWidth(canvas.width * (1000 / imgWidth));
          canvas.setHeight(canvas.height * (1000 / imgWidth));
        }
      },
      success: function (response) {
        document.getElementById("canvasDiv").style.display = "block";
        document.getElementById("previewImage").style.display = "none";
        document.getElementById("uploadbutton").disabled = false;
        if (imgHeight > imgWidth) {
          canvas.setZoom(1);
          canvas.setWidth((canvas.width * 800) / imgHeight);
          canvas.setHeight((canvas.height * 800) / imgHeight);
        } else {
          canvas.setZoom(1);
          canvas.setWidth(canvas.width * (1000 / imgWidth));
          canvas.setHeight(canvas.height * (1000 / imgWidth));
        }
        if (response.success) {
          document.getElementById("uploadedUrl").value = response.data.link;
          //change upload button inner text to "Reupload"
          document.getElementById("uploadbutton").innerHTML = "Reupload";
          document.getElementById("uploadedUrl").style.display = "inline-block";
          document.getElementById("copyToClipboard").style.display =
            "inline-block";
          document.getElementById("checkForRIS").style.display = "inline-block";
          document.getElementById("PostReddit").style.display = "inline-block";
          document.getElementById("roundTitle").style.display = "inline-block";
          document.getElementById("roundAnswer").style.display = "inline-block";
          document.getElementById("Save").style.display = "inline-block";
          document.getElementById("Download").style.display = "inline-block";
          document.getElementById("Copy").style.display = "inline-block";
          document.getElementById("Export").style.display = "inline-block";
        } else {
          alert("Failed to upload.");
        }
      },
    });
    document.getElementById("uploadbutton").value = "Uploading...";
    document.getElementById("uploadbutton").disabled = true;
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
    setTimeout(function () {
      window.open(
        "https://yandex.com/images/search?url=" + url + "&rpt=imageview"
      );
    }, 2000);
    setTimeout(function () {
      window.open("http://www.tineye.com/search/?url=" + url);
    }, 2000);
    setTimeout(function () {
      window.open("https://lens.google.com/uploadbyurl?url=" + url);
    }, 2000);
    setTimeout(function () {
      window.open(
        "https://www.google.com/searchbyimage?sbisrc=cr_1_5_2&image_url=" + url
      );
    }, 2000);
    setTimeout(function () {
      window.open(
        "https://www.bing.com/images/searchbyimage?cbir=ssbi&imgurl=" + url
      );
    }, 2000);
  } else {
    window.open(
      "https://yandex.com/images/search?url=" + url + "&rpt=imageview"
    );
    var popUp = window.open("http://www.tineye.com/search/?url=" + url);
    if (popUp == null || typeof popUp == "undefined") {
      alert(
        "The other RIS sites were blocked by the browser. Please allow popups for this site."
      );
    } else {
      popUp.focus();
    }
    window.open(
      "https://www.bing.com/images/searchbyimage?cbir=ssbi&imgurl=" + url
    );
    window.open("https://lens.google.com/uploadbyurl?url=" + url);
    window.open(
      "https://www.google.com/searchbyimage?sbisrc=cr_1_5_2&image_url=" + url
    );
  }
}

function updateOpacity() {
  var text = document.getElementById("sliderValue");
  var slider = document.getElementById("alpha");
  text.innerText = slider.value;
  maskImage.set("opacity", parseInt(slider.value) / 100);
  canvas.renderAll();
}

function updateHue() {
  var firstHue = true;
  var hueIndex;
  var slider = document.getElementById("hue");

  if (maskImage.filters.length > 0) {
    for (var i = 0; i < maskImage.filters.length; i++) {
      if (maskImage.filters[i].hasOwnProperty("rotation")) {
        firstHue = false;
        hueIndex = i;
      }
    }
  }
  if (maskImage.filters.length == 0 || firstHue) {
    var filter = new fabric.Image.filters.HueRotation({
      rotation: slider.value,
    });
    maskImage.filters.push(filter);
  } else {
    maskImage.filters[hueIndex]["rotation"] = slider.value;
  }
  maskImage.applyFilters();
  canvas.renderAll();
}

function updateZoomer() {
  var slider = document.getElementById("zoom");
  maskImage.set("scaleX", 0.25 * Math.pow(Math.E, 0.0277 * slider.value));
  maskImage.set("scaleY", 0.25 * Math.pow(Math.E, 0.0277 * slider.value));
  canvas.renderAll();
}

$(document).on("input", "#brushSize", function () {
  canvas.freeDrawingBrush.width = parseInt($(this).val());
});

function colorSelect() {
  var color = document.getElementById("colorSelect");
  canvas.freeDrawingBrush.color = color.value;
}

function postReddit(index, subreddit) {
  var request = new XMLHttpRequest();
  request.open("GET", "https://api.picturegame.co/current", true);
  request.onload = () => {
    var textResponse = request.responseText;
    var jsonResponse = JSON.parse(textResponse);
    var roundNumber = jsonResponse["round"]["roundNumber"];
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
    if (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    ) {
      redditURL = "http://old.reddit.com/r/";
    } else {
      redditURL = "http://www.reddit.com/r/";
    }
    var redditLink =
      redditURL +
      subreddit +
      "/submit?url=" +
      imageLink +
      "&title=" +
      round +
      roundTitle;
    window.open(redditLink);
  };
  request.send();
}

function saveImage(mode) {
  canvas.renderAll();
  if (mode == 1) {
    var imageURL = document.getElementById("uploadedUrl").value;
    var roundTitle = document.getElementById("roundTitle").value;
    var roundAnswer = document.getElementById("roundAnswer").value;
  } else {
    var imageURL = document.getElementById("saveFromURLURL").value;
    var roundTitle = document.getElementById("saveFromURLTitle").value;
    var roundAnswer = document.getElementById("saveFromURLAnswer").value;
  }

  roundData = [imageURL, roundTitle, roundAnswer];

  if (
    JSON.parse(localStorage.getItem("rounds")) == null ||
    JSON.parse(localStorage.getItem("rounds")) == ""
  ) {
    localStorage.setItem("rounds", JSON.stringify([roundData]));
  } else {
    var previousRoundData = JSON.parse(localStorage.getItem("rounds"));
    previousRoundData.push(roundData);
    localStorage.setItem("rounds", JSON.stringify(previousRoundData));
  }
  var saveElement = mode == 1 ? "Save" : "saveExternal";
  var button = document.getElementById(saveElement);
  button.innerText = "Saved!";
  button.style.backgroundColor = "rgb(175, 211, 161)";
}

function downloadImage() {
  updatePreview();
  if (imgHeight > imgWidth) {
    canvas.setZoom(imgHeight / 800);
    canvas.setWidth(imgWidth);
    canvas.setHeight(imgHeight);
  } else {
    canvas.setZoom(imgWidth / 1000);
    canvas.setWidth(imgWidth);
    canvas.setHeight(imgHeight);
  }

  var downloadLink = document.createElement("a");
  downloadLink.href = canvas.toDataURL("image/png").replace("image/png");
  var d = new Date();
  var formattedDate =
    d.getFullYear() +
    "-" +
    (d.getMonth() + 1) +
    "-" +
    d.getDate() +
    " " +
    d.getHours() +
    "-" +
    d.getMinutes();
  downloadLink.download = "round " + formattedDate + ".png";

  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  if (imgHeight > imgWidth) {
    canvas.setZoom(1);
    canvas.setWidth((canvas.width * 800) / imgHeight);
    canvas.setHeight((canvas.height * 800) / imgHeight);
  } else {
    canvas.setZoom(1);
    canvas.setWidth(canvas.width * (1000 / imgWidth));
    canvas.setHeight(canvas.height * (1000 / imgWidth));
  }
  updatePreview();
}

function copyImage() {


  updatePreview();
  if (imgHeight > imgWidth) {
    canvas.setZoom(imgHeight / 800);
    canvas.setWidth(imgWidth);
    canvas.setHeight(imgHeight);
  } else {
    canvas.setZoom(imgWidth / 1000);
    canvas.setWidth(imgWidth);
    canvas.setHeight(imgHeight);
  }
  try {

    blob = dataURItoBlob(canvas.toDataURL("image/png"));
    const item = new ClipboardItem({ "image/png": blob });
    navigator.clipboard.write([item]);
  } catch (err) {
    alert("This feature isn't supported on Firefox by default. Set dom.events.asyncClipboard.clipboardItem to true (FF 87 or more required)");
  }

  if (imgHeight > imgWidth) {
    canvas.setZoom(1);
    canvas.setWidth(canvas.width * 800 / imgHeight);
    canvas.setHeight(canvas.height * 800 / imgHeight);
  } else {
    canvas.setZoom(1);
    canvas.setWidth(canvas.width * (1000 / imgWidth));
    canvas.setHeight(canvas.height * (1000 / imgWidth));
  }
  updatePreview();

}

function dataURItoBlob(dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(",")[1]);

  // separate out the mime component
  var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  var ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], { type: mimeString });
  return blob;
}

var i = 0;
//What a mess...
function displaySavedRounds(direction) {
  if (
    JSON.parse(localStorage.getItem("rounds")) == null ||
    JSON.parse(localStorage.getItem("rounds")) == ""
  ) {
    alert("There are no saved images!");
    return true;
  } else {
    if (direction == 1) {
      i--;
    } else if (direction == 2) {
      i++;
    } else if (direction == 0) {
      i = 0;
      if (document.getElementById("savedRounds").style.display == "block") {
        document.getElementById("savedRounds").style.display = "none";
        document.getElementById("saveFromURL").style.display = "block";
        return true;
      } else {
        setTimeout(function () {
          window.scrollTo(0, document.body.scrollHeight);
        }, 100);
      }
    }
    document.getElementById("saveFromURL").style.display = "none";
    var rounds = JSON.parse(localStorage.getItem("rounds"));

    document.getElementById("savedRounds").style.display = "block";

    var imageLink = document.getElementById("displayedImagelink");
    imageLink.setAttribute("href", rounds[i][0]);

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
    var rounds = JSON.parse(localStorage.getItem("rounds"));
    roundsAfter = rounds.slice(0, i).concat(rounds.slice(i + 1, rounds.length));
    localStorage.setItem("rounds", JSON.stringify(roundsAfter));

    if (roundsAfter.length == 0) {
      document.getElementById("savedRounds").style.display = "none";
      document.getElementById("saveFromURL").style.display = "block";
    } else {
      i = 0;
      displaySavedRounds(3);
    }
  }
}

function addMask() {
  var br = document.getElementById("br");
  var uploadedMask = document.getElementById("customMaskURL").value;
  br.insertAdjacentHTML(
    "beforeBegin",
    "<img width='95' height='95' class=\"myMasks\" src=\"" +
      uploadedMask +
      "\" onclick='loadMask(this,60)' /> "
  );

  if (
    localStorage.getItem("masks") == null ||
    localStorage.getItem("masks") == ""
  ) {
    localStorage.setItem("masks", uploadedMask);
  } else {
    var masks = localStorage.getItem("masks");
    masks += ";" + uploadedMask;
    localStorage.setItem("masks", masks);
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

var filters = [
  "grayscale",
  "invert",
  "remove-color",
  "sepia",
  "brownie",
  "brightness",
  "contrast",
  "saturation",
  "noise",
  "vintage",
  "pixelate",
  "blur",
  "sharpen",
  "emboss",
  "technicolor",
  "polaroid",
  "blend-color",
  "gamma",
  "kodachrome",
  "blackwhite",
  "blend-image",
  "hue",
  "resize",
];

function invert() {
  ObjectName = "mask";
  function selectObject(ObjectName) {
    canvas.getObjects().forEach(function (o) {
      if (o.id === ObjectName) {
        canvas.setActiveObject(o);
      }
    });
  }
  selectObject(ObjectName);
  var object = canvas.getActiveObject();
  var filter = new fabric.Image.filters.Invert();
  object.filters.push(filter);
  object.applyFilters();
  canvas.renderAll();
}

if (
  localStorage.getItem("masks") === null ||
  localStorage.getItem("masks") === ""
) {
} else {
  //I don't know why I have to do it like this to avoid triggering loadMasks when masks is empty
  loadMasks();
}

function loadMasks() {
  var br = document.getElementById("br");
  var savedMasks = localStorage.getItem("masks");
  var masksArray = savedMasks.split(";");
  for (i = 0; i < masksArray.length; i++) {
    br.insertAdjacentHTML(
      "beforeBegin",
      "<img width='95' height='95' class=\"myMasks\" src=\"" +
        masksArray[i] +
        "\" onclick='loadMask(this,60)' /> "
    );
  }
}

//*****************Keyboard shortcuts *********************/

//undo on CTRL+Z
$(document).on("keydown", function (e) {
  if (e.ctrlKey && e.which === 90) {
    undo();
  }
});

var opac = 1;
//Rotate masks with left and right arrows
//Set opacity of selected object (masks or lines) with up and down arrows
//Clone object with ALT
//Press "Insert" to choose a custom subreddit

$(document).on("keydown", function (e) {
  var target = $(e.target);
  if (e.which == 37) {
    if (target.is("input")) {
    } else {
      e.preventDefault();
      if (document.getElementById("savedRounds").style.display == "block") {
        displaySavedRounds(1);
      } else {
        var originalAngle = maskImage.get("angle");
        maskImage.rotate(originalAngle - 2);
        canvas.renderAll();
      }
    }
  }
  if (e.which == 39) {
    if (target.is("input")) {
    } else {
      e.preventDefault();
      if (document.getElementById("savedRounds").style.display == "block") {
        displaySavedRounds(2);
      } else {
        var originalAngle = maskImage.get("angle");
        maskImage.rotate(originalAngle + 2);
        canvas.renderAll();
      }
    }
  }
  if (e.which == 40) {
    e.preventDefault();
    if (canvas.getActiveObject()) {
      var obj = canvas.getActiveObject();
    } else {
      var obj = canvas._objects[canvas._objects.length - 1];
    }
    if (opac > 0.1) {
      opac = opac - 0.1;
    }
    obj.set("opacity", opac);
    canvas.renderAll();
  }
  if (e.which == 38) {
    e.preventDefault();
    if (canvas.getActiveObject()) {
      var obj = canvas.getActiveObject();
    } else {
      var obj = canvas._objects[canvas._objects.length - 1];
    }
    if (opac <= 1) {
      opac = opac + 0.1;
    }
    obj.set("opacity", opac);
    canvas.renderAll();
  }
  if (e.which == 220) {
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
    var newSubInput = document.getElementById("newSubInput");
    newSubInput.style.display = "inline-block";
    var newSub = newSubInput.value;
    var newPost = document.getElementById("PostReddit");
    newPost.innerText = "Post to /r/";
  }
  if (e.which === 87) {
    canvas.freeDrawingBrush.width =
      parseInt(document.getElementById("brushSize").value) + 5;
    document.getElementById("brushSize").value =
      parseInt(document.getElementById("brushSize").value) + 5;
  }
  if (e.which === 83) {
    canvas.freeDrawingBrush.width =
      parseInt(document.getElementById("brushSize").value) - 5;
    document.getElementById("brushSize").value =
      parseInt(document.getElementById("brushSize").value) - 5;
  }
  //bind delete object to DEL key
  if (e.which === 46) {
    deleteObject();
  }
});

function updateBrushOpacity() {
  var brushOpacity = parseInt(
    document.getElementById("brushOpacity").value / 100
  );
  if (canvas.getActiveObject()) {
    var obj = canvas.getActiveObject();
  } else {
    var obj = canvas._objects[canvas._objects.length - 1];
  }
  obj.set("opacity", brushOpacity);
  canvas.freeDrawingBrush.color = hexToRgb(
    document.getElementById("colorSelect").value
  );
  canvas.renderAll();
}

function updateInfo() {
  var roundTitle = document.getElementById("displayedTitle").value;
  var roundAnswer = document.getElementById("displayedAnswer").value;
  rounds = JSON.parse(localStorage.getItem("rounds"));
  rounds[i][1] = roundTitle;
  rounds[i][2] = roundAnswer;
  localStorage.setItem("rounds", JSON.stringify(rounds));
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

$("#country").on("change", function () {
  loadMask(this.value, 75, "country", 25, false);
});

function copyYml(index) {
  var roundTitle;
  var roundAnswer;
  var imageLink;

  if (index == 2) {
    roundTitle = document.getElementById("roundTitle").value;
    roundAnswer = document.getElementById("roundAnswer").value;
    imageLink = document.getElementById("uploadedUrl").value;
  } else {
    roundTitle = document.getElementById("displayedTitle").value;
    roundAnswer = document.getElementById("displayedAnswer").value;
    imageLink = document.getElementById("displayedImagelink").href;
  }

  var text = `masker_round_${Date.now()}:
  title: |
    ${roundTitle}
  url: ${imageLink}
  answer: ${roundAnswer}
`;

  var el = document.createElement("textarea");
  // Set value (string to be copied)
  el.value = text;

  // Set non-editable to avoid focus and move outside of view
  el.setAttribute("readonly", "");
  el.style = { position: "absolute", left: "-9999px" };
  document.body.appendChild(el);

  // Select text inside element
  el.select();

  // Copy text to clipboard
  document.execCommand("copy");

  // Remove temporary element
  document.body.removeChild(el);
}

function submitAccessToken() {
  var accessToken = document.getElementById("accessTokenInput").value;
  localStorage.setItem("accessToken", accessToken);
  document.getElementById("accessTokenInput").value = "";
  document.getElementById("accessTokenInput").placeholder =
    "Access token saved";
}

function deleteAccessToken() {
  localStorage.removeItem("accessToken");
  document.getElementById("accessTokenInput").value = "";
  document.getElementById("accessTokenInput").placeholder =
    "Access token deleted";
}

//load localstorage accessToken and set it in accessTokenInput
var accessToken = localStorage.getItem("accessToken");
if (accessToken) {
  document.getElementById("accessTokenInput").value = accessToken;
}

//function to convert hex color to rgb
function hexToRgb(hex) {
  var opacity = document.getElementById("brushOpacity").value / 100;
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  var output =
    "rgba(" +
    parseInt(result[1], 16) +
    "," +
    parseInt(result[2], 16) +
    "," +
    parseInt(result[3], 16) +
    "," +
    opacity +
    ")";
  return output;
}

//function to rotate the mask with the angle slider
function rotateMask() {
  var angle = parseFloat(document.getElementById("angle").value);
  maskImage.rotate(angle);
  canvas.renderAll();
  canvas.renderAll();
}

function addText() {
  canvas.add(
    new fabric.IText("2click 2edit", {
      left: canvas.width / 3,
      top: canvas.height / 3,
      fontFamily: "arial black",
      fill: document.getElementById("colorSelectText").value,
      fontSize: parseInt(document.getElementById("textSize").value),
    })
  );
  canvas.isDrawingMode = false;
  canvas.renderAll();
}

//function to use the eraser
function eraser() {
  canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush.width = parseInt(
    document.getElementById("brushSize").value
  );
  canvas.renderAll();
}
//function to use the brush
function brush() {
  canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush.width = parseInt(
    document.getElementById("brushSize").value
  );
  canvas.freeDrawingBrush.color = hexToRgb(
    document.getElementById("colorSelect").value
  );
  canvas.renderAll();
}
//function to disable drawing mode
function disableDrawingMode() {
  canvas.isDrawingMode = false;
  canvas.renderAll();
}

//function to add a rectangle
function addRect() {
  canvas.add(
    new fabric.Rect({
      left: canvas.width / 3,
      top: canvas.height / 3,
      fill: hexToRgb(document.getElementById("colorSelect").value),
      width: 100,
      height: 100,
    })
  );
  canvas.isDrawingMode = false;
  canvas.renderAll();
}

//function to duplicate the mask
function duplicateMask() {
  if (canvas.getActiveObject()) {
    var obj = canvas.getActiveObject();
  } else {
    var obj = canvas._objects[canvas._objects.length - 1];
  }
  var object = fabric.util.object.clone(obj);
  object.set("top", object.top + 7);
  object.set("left", object.left + 7);
  canvas.add(object);
  canvas.isDrawingMode = false;
  canvas.renderAll();
}

//function to delete the selected object
function deleteObject() {
  canvas.remove(canvas.getActiveObject());
  canvas.isDrawingMode = false;
  canvas.renderAll();
}
