var uploadPreview;
var fileSelect;
var currentFile;
var isUserLoggedIn = false;

var onFileSelected = function() {
    var files = fileSelect.files;

    while (uploadPreview.firstChild) {
        uploadPreview.removeChild(uploadPreview.firstChild);
    }
    uploadPreview.className = "";

    for (var i = 0; i < files.length; i++) {
        var image = document.createElement("img");
        var exifRemoved = false;
        var previewLoadHandler = (function (file) {
            return function (evt) {
                if (exifRemoved) {
                    image.style.opacity = 1;
                } else {
                    image.style.top = (-this.height + 15) + "px";
                    if (file.type !== "image/jpeg") {
                        image.style.opacity = 1;
                        return;
                    }
                    autoRotateImage(evt.target);
                    evt.target.src = stripEXIF(evt.target);
                    exifRemoved = true;
                }
            }
        })(files[i]);
        // This load event listener will fire twice
        // First time when local preview image is initially loaded
        // Second time after the image element's src property
        // is changed to be the modified version without orientation
        image.addEventListener("load", previewLoadHandler);
        var reader = new FileReader();
        reader.readAsDataURL(files[i]);
        reader.onloadend = function() {
            var dataURL = reader.result;
            image.src = dataURL;
        };
        // var blobURL = window.URL.createObjectURL(files[i]);
        // image.src = blobURL;
        image.className = "image-preview";
        uploadPreview.appendChild(image);
        uploadPreview.className = "selected";
        currentFile = files[i];
    }

    uploadPreview.style.boxShadow = "";
}

var onFileUploaded = function() {
    let json;
    try {
        json = JSON.parse(this.responseText);
    } catch (err) {
        handleResponseFailure(this.status);
        return console.error("[onFileUploaded]", "Error occurred when parsing response", err);
    }
    fileSelect.value = "";
    if (this.status !== 200) {
        console.error("An error ocurred: " + json.message);
        uploadPreview.style.boxShadow = "";
        uploadPreview.classList.add("error");
        showNotification(json.message, {
            error: true
        });
        return;
    }
    window.location.href = window.location.origin + "/images/" + json.id;
}

var onFileProgress = function(progressEvent) {
    if (progressEvent.lengthComputable) {
        var shadowValue = Math.floor((progressEvent.loaded / progressEvent.total) * 10);
        uploadPreview.style.boxShadow = "0px 3px 25px " + shadowValue.toString() + "px #ff0";
    }
}

var uploadFile = function(file) {
    var form = $("form[id='upload']");
    var action = form.attr("action");
    var req = new XMLHttpRequest();
    var formData = new FormData();
    
    uploadPreview.classList.remove("error");
    
    req.onload = onFileUploaded;
    req.onprogress = onFileProgress;
    req.open("post", action);
    req.setRequestHeader("X-CSRF-TOKEN", csrfToken);
    formData.append("myFile", currentFile);
    req.send(formData);
}

$(document).ready(function() {
    fileSelect = document.getElementById("select-me");
    uploadPreview = $("#upload-preview").get(0);

    fileSelect.addEventListener("change", onFileSelected);

    $("#select-button").on('click', function (evt) {
        performLoggedInAction(evt, function() {
            fileSelect.click();
        });
    });

    $("#upload-button").on("click", function (evt) {
        performLoggedInAction(evt, function() {
            uploadFile(currentFile);
        });
    });
});

var checkUserLogin = function (callback) {
    var req = new XMLHttpRequest();
    req.open("get", "/user");
    req.send();
    req.onload = function() {
        callback(this.status);
    }
}

var performLoggedInAction = function(evt, callback) {
    if(isLoginRequired === "true" && !isUserLoggedIn) {
        evt.preventDefault();
        checkUserLogin(function (status) {
            if(status !== 200) {
                openLogin();
                return;
            }
            else {
                isUserLoggedIn = true;
                callback();
            }
        });
    }
    else {
        callback();
    }
}