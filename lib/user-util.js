const util = require("./util");

module.exports.generateUserImageHTML = function(imageInfo) {
    var element = "<a href='/images/" +  imageInfo.id + "'>";

    element += "<img class='user-image' style='max-width: 200px; max-height: 200px;' src='/images/" + imageInfo.id + "." + util.mimeTypeToExt(imageInfo.mimeType) + "'>";

    element += "</a>"
    return element;
};