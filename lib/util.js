var mimeTypes = require("mime-types");
var url = require("url");
const { encode } = require("html-entities");

module.exports.getIDFromParam = function (idStr) {
    return idStr;
};

module.exports.extToMimeType = function (ext) {
    return mimeTypes.lookup(ext) || undefined;
};

module.exports.mimeTypeToExt = function (mimeType) {
    return mimeTypes.extension(mimeType) || undefined;
};

module.exports.isValidImageType = function (mimeType) {
    switch (mimeType) {
        case "image/gif":
        case "image/png":
        case "image/jpeg":
        case "image/bmp":
            return true;
    }
    return false;
};

module.exports.getValidImageTypes = function () {
    return [".png", ".jpeg", ".jpg", ".bmp", ".gif"];
};

module.exports.getValidImageTypesString = function () {
    return module.exports.getValidImageTypes().join(", ");
};

module.exports.getExpireTimeString = (expireAfterSeconds, isEvaluationMode) =>
    isEvaluationMode && expireAfterSeconds != null
        ? `${expireAfterSeconds >= 60 ? expireAfterSeconds / 60 : expireAfterSeconds} ${
              expireAfterSeconds >= 60
                  ? expireAfterSeconds === 60
                      ? "minute"
                      : "minutes"
                  : expireAfterSeconds === 1
                  ? "second"
                  : "seconds"
          }`
        : null;

module.exports.getFileSizeLimitString = (fileSizeLimit) =>
    fileSizeLimit != null ? (fileSizeLimit / 1000000).toString() + " MB" : "unspecified";

module.exports.sanitizeText = function (text) {
    // TODO:#95 remove sanitizeText
    return text;
};

module.exports.escapeOutput = function (text) {
    return encode(text);
};

module.exports.getRedirectPath = function (redirectUrl) {
    if (redirectUrl === undefined) {
        return "/";
    }
    var urlObj = url.parse(redirectUrl);
    // check for bad stuff
    if (
        urlObj.protocol === "javascript:" ||
        urlObj.protocol === "vbscript:" ||
        urlObj.protocol === "data:" ||
        urlObj.pathname.indexOf("//") == 0 ||
        urlObj.pathname.search("%0D|%0A") >= 0
    ) {
        return "/";
    }
    return urlObj.pathname;
};

var convertImageBinaryToBase64 = function (imgBin) {
    if (!imgBin) {
        return undefined;
    }
    return Buffer.from(imgBin).toString("base64");
};

module.exports.constructBase64ImageArray = function (imgArr) {
    if (!imgArr) {
        return undefined;
    }
    var base64Images = [];
    imgArr.forEach(function (imageData) {
        base64Images.push({
            mimeType: imageData.mimetype,
            data: convertImageBinaryToBase64(imageData.data.buffer),
            id: imageData.id,
        });
    });
    return base64Images;
};

if (process.env.NODE_ENV === "test") {
    module.exports.convertImageBinaryToBase64 = convertImageBinaryToBase64;
}
