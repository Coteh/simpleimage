var uploadPreview;
var fileSelect;
var currentFile;

var onFileSelected = function() {
    var files = fileSelect.files;

    while (uploadPreview.firstChild) {
        uploadPreview.removeChild(uploadPreview.firstChild);
    }
    uploadPreview.className = "";

    for (var i = 0; i < files.length; i++) {
        var image = document.createElement("img");
        image.src = window.URL.createObjectURL(files[i]);
        image.className = "image-preview";
        image.onload = function() {
            image.style.top = (-this.height + 15) + "px";
        };
        uploadPreview.appendChild(image);
        uploadPreview.className = "selected";
        currentFile = files[i];
    }

    uploadPreview.style.boxShadow = "";
}

var onFileUploaded = function() {
    json = JSON.parse(this.responseText);
    fileSelect.value = "";
    if (this.status === 500) {
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
    formData.append("myFile", currentFile);
    req.send(formData);
}

$(document).ready(function() {
    fileSelect = document.getElementById("select-me");
    uploadPreview = $("#upload-preview").get(0);

    fileSelect.addEventListener("change", onFileSelected);

    $("#select-button").on('click', function (evt) {
        if (evt.target.tagName === "SPAN") {
            fileSelect.click();
        }
    });

    $("#upload-button").on("click", function () {
        uploadFile(currentFile);
    });
});