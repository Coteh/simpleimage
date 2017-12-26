var commentCount = 0;

var updateCommentsCounter = function() {
    $("#comment-count").text(commentCount.toString() + " comment" + ((commentCount != 1) ? "s" : ""));
};

var onCommentsLoaded = function() {
    var commentsElements;
    var parentElement = document.getElementById("comments-container");
    if (this.status !== 200) {
        var jsonObj = JSON.parse(this.responseText);
        commentsElements = "<div id='comments' class='error'>Could not load comments: " + jsonObj.message + "</div>"
    } else {
        var jsonObj = JSON.parse(this.responseText);
        commentsElements = jsonObj.results;
    }
    parentElement.innerHTML = commentsElements;
    convertTimeElementsToLocalTime(parentElement);
    commentCount = numberOfCommentHTMLElements(commentsElements);
    updateCommentsCounter();
};

var onCommentSubmitted = function() {
    var submittedComment;
    var parentElement = document.querySelector("#comments-container #comments");
    if (this.status !== 200) {
        jsonObj = JSON.parse(this.responseText);
        showNotification(jsonObj.message, {
            error: true
        });
    } else {
        jsonObj = JSON.parse(this.responseText);
        submittedComment = jsonObj.message;
        commentCount++;
        updateCommentsCounter();
        var formattedCmt = $(submittedComment)
            .css("background-color", "#FFEB3B");
        parentElement.innerHTML = formattedCmt.get(0).outerHTML + parentElement.innerHTML;
    }
    convertTimeElementsToLocalTime(parentElement);
};

window.requestComments = function(imageID) {
    var req = new XMLHttpRequest();
    req.onload = onCommentsLoaded;
    req.open("get", "/images/" + imageID + "/comments?type=json&responseType=html");
    req.send();
};

var submitComment = function() {
    var form = $("form[id='comment']");
    var action = form.get(0).action;
    var req = new XMLHttpRequest();

    req.onload = onCommentSubmitted;
    req.open("post", action);
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.send(form.serialize());
};

$(document).ready(function() {
    $("form[id='comment']").on("submit", function(e) {
        e.preventDefault();
        submitComment();
        return false;
    });
});