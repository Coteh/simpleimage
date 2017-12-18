var onUserCommentsLoaded = function (callback) {
    var commentsElements;
    var parentElement = document.getElementById("comments-container");
    if (this.status !== 200) {
        commentsElements = "<div id='comments'>ERROR: Could not get comments.</div>"
    } else {
        commentsElements = this.responseText;
    }
    parentElement.innerHTML = commentsElements;
    convertTimeElementsToLocalTime(parentElement);
    if (callback !== undefined) {
        callback(commentsElements, $(commentsElements).children().length);
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