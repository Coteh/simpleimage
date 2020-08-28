var onUserCommentsLoaded = function (callback) {
    var commentsElements;
    var parentElement = document.getElementById("comments-container");
    if (this.status !== 200) {
        commentsElements = "<div id='comments'>ERROR: Could not get comments.</div>";
    } else {
        commentsElements = this.responseText;
    }
    parentElement.innerHTML = commentsElements;
    convertTimeElementsToLocalTime(parentElement);
    if (callback !== undefined) {
        callback(commentsElements, $(commentsElements).children().length);
    }
};

var onUserImagesLoaded = function (callback) {
    var imagesElement = document.createElement("div");
    var parentElement = document.getElementById("images-container");
    var placeholderElement = document.getElementById("images-placeholder");

    imagesElement.style.display = "none";

    if (this.status !== 200) {
        imagesElement.innerHTML = "<div class='info-box'>Could not get images due to an error.</div>";
        placeholderElement.style.display = "none";
        imagesElement.style.display = "";
        parentElement.appendChild(imagesElement);
        if (callback !== undefined) {
            callback(imagesElement, 0);
        }
        return;
    } else {
        imagesElement.innerHTML = this.responseText;
    }

    parentElement.appendChild(imagesElement);

    var userImagesCount = $("#user-images", imagesElement).children().length;

    if (userImagesCount === 0) {
        imagesElement.innerHTML = "<div class='info-box'>This user has not uploaded any images.</div>";
        placeholderElement.style.display = "none";
        imagesElement.style.display = "";
    } else {
        var loadedCount = 0;

        $(".user-image").on("load", function () {
            loadedCount++;
            if (loadedCount >= userImagesCount) {
                placeholderElement.style.display = "none";
                imagesElement.style.display = "";
            }
        });
    }

    if (callback !== undefined) {
        callback(imagesElement, userImagesCount);
    }
};

window.requestCommentsUser = function (username, callback) {
    var req = new XMLHttpRequest();
    req.onload = function() {
        var func = onUserCommentsLoaded.bind(this, callback);
        func();
    };
    req.open("get", "/users/" + username + "/comments?type=html");
    req.send();
};

window.requestImagesUser = function (username, callback) {
    var req = new XMLHttpRequest();
    req.onload = function() {
        var func = onUserImagesLoaded.bind(this, callback);
        func();
    };
    req.open("get", "/users/" + username + "/images?type=html");
    req.send();
};
