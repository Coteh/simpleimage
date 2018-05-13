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
    if (this.status !== 200) {
        imagesElement.innerHTML = "<span>ERROR: Could not get images.</span>";
    } else {
        imagesElement.innerHTML = this.responseText;
    }
    parentElement.appendChild(imagesElement);
    placeholderElement.style = "display:none;";
    if (callback !== undefined) {
        callback(imagesElement, 0);
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