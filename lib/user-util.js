const util = require("./util");

module.exports.generateBase64ImageHTML = function(base64ImageInfo) {
    var element = "<a href='/images/" +  base64ImageInfo.id + "'>";

    element += "<img class='user-image' style='max-width: 200px; max-height: 200px;' src='/images/" + base64ImageInfo.id + "." + util.mimeTypeToExt(base64ImageInfo.mimeType) + "'>";

    element += "</a>"
    return element;
};