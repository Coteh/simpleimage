var util = require("./util");

const getImageFilename = (id, mime) => id == null ? "removed.png" : `${id}.${util.mimeTypeToExt(mime)}`;

var generateCommentHTML = function(comment, type, data) {
    if (comment === undefined || type === undefined) {
        return "<div id='comment'>Comment data could not be loaded.</div>";
    }

    if (comment.comment == null) {
        comment.comment = "NULL";
    }

    var escapedUsername = util.escapeOutput(comment.username);
    var escapedComment = util.escapeOutput(comment.comment);

    switch (type) {
        case "image":
            return "<div class=\"comment\">" +
                "<a href=\"/users/" + escapedUsername + "\">" + escapedUsername + "</a><br>" 
                + "<span class=\"time\">" + comment.postedDate.toUTCString() + "</span><br>"
                + escapedComment
                + "</div>";
        case "user":
            const image = data.images[comment.imageID];
            return "<div class=\"comment\">"
            + "<a aria-label=\"Image Link\" href=\"/images/" + comment.imageID + "\">" 
            + `<img alt=\"Image\" style=\"width:100px\" src=\"/images/${getImageFilename(image?.id, image?.mimetype)}\">`
            + "</a><br>"
                + "<span class=\"time\">" + comment.postedDate.toUTCString() + "</span><br>"
                + escapedComment
                + "</div>";
    }
};

var prepareCommentsHTML = function(comments, commentType, data) {
    var message = "<div id=\"comments\">";
    comments.forEach(function (comment) {
        message += generateCommentHTML(comment, commentType, data);
    });
    message += "</div>";
    return message;
};

var prepareCommentsJSON = function(comments) {
    var message = [];
    comments.forEach(function (comment) {
        message.push(comment);
    });
    return message;
};

var prepareComments = function(comments, responseType, commentType) {
    switch (responseType) {
        case "html":
            return prepareCommentsHTML(comments, commentType);
        case "json":
        default:
            return prepareCommentsJSON(comments);
    }
};

module.exports.generateCommentHTML = generateCommentHTML;
module.exports.prepareCommentsHTML = prepareCommentsHTML;
module.exports.prepareCommentsJSON = prepareCommentsJSON;
module.exports.prepareComments = prepareComments;
