var util = require("./util");

const getImageFilename = (id, mime) => id == null ? "removed.png" : `${id}.${util.mimeTypeToExt(mime)}`;

const createCommentResponseObject = (comment, imageEntry) => ({
    username: util.escapeOutput(comment.username),
    comment: util.escapeOutput(comment.comment),
    imageID: comment.imageID,
    postedDate: comment.postedDate,
    imagePageURL: `/images/${comment.imageID}`,
    imageURL: imageEntry ? `/images/${getImageFilename(imageEntry?.id, imageEntry?.mimetype)}` : '/images/removed.png',
});

module.exports.createCommentResponseObject = createCommentResponseObject;
