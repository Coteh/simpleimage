const util = require("./util");

module.exports.createUserImageResponseObject = function(imageInfo) {
    return {
        id: imageInfo.id,
        url: "/images/" + imageInfo.id,
        imageURL: "/images/" + imageInfo.id + "." + util.mimeTypeToExt(imageInfo.mimetype),
        mimeType: imageInfo.mimetype
    };
};
