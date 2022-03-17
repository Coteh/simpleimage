var uploadPreview;
var fileSelect;
var currentFile;
var isUserLoggedIn = false;

const showUploadPreview = async function (file) {
    while (uploadPreview.firstChild) {
        uploadPreview.removeChild(uploadPreview.firstChild);
    }
    uploadPreview.className = "";
    uploadPreview.style.boxShadow = "";

    const imageElem = document.createElement("img");
    imageElem.className = "image-preview";
    uploadPreview.appendChild(imageElem);

    const imageData = await readImage(file);
    await setImageSrc(imageElem, imageData);

    imageElem.style.transform = "translateY(-90%)";
    imageElem.style.opacity = 1;

    uploadPreview.className = "selected";
};

const onFileSelected = function () {
    const files = fileSelect.files;

    if (files.length === 0) {
        return showNotification("No files selected", {
            error: true,
            close: true,
        });
    }

    currentFile = files[0];

    showUploadPreview(files[0]);
};

const onFileUploaded = function () {
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
            error: true,
        });
        return;
    }
    window.location.href = window.location.origin + "/images/" + json.id;
};

const onFileProgress = function (progressEvent) {
    if (progressEvent.lengthComputable) {
        var shadowValue = Math.floor((progressEvent.loaded / progressEvent.total) * 10);
        uploadPreview.style.boxShadow = "0px 3px 25px " + shadowValue.toString() + "px #ff0";
    }
};

const uploadFile = function (file) {
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
};

$(document).ready(function () {
    fileSelect = document.getElementById("select-me");
    fileSelect.value = "";
    uploadPreview = $("#upload-preview").get(0);

    fileSelect.addEventListener("change", onFileSelected);

    $("#select-button").on("click", function (evt) {
        performLoggedInAction(evt, function () {
            fileSelect.click();
        });
    });

    $("#upload-button").on("click", function (evt) {
        performLoggedInAction(evt, function () {
            uploadFile(currentFile);
        });
    });
});

const checkUserLogin = function (callback) {
    var req = new XMLHttpRequest();
    req.open("get", "/user");
    req.send();
    req.onload = function () {
        callback(this.status);
    };
};

const performLoggedInAction = function (evt, callback) {
    if (isLoginRequired === "true" && !isUserLoggedIn) {
        evt.preventDefault();
        checkUserLogin(function (status) {
            if (status !== 200) {
                openLogin();
                return;
            } else {
                isUserLoggedIn = true;
                callback();
            }
        });
    } else {
        callback();
    }
};
