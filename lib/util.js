var mimeTypes = require("mime-types");
var url = require("url");

var encodeHTML = function (text) {
    if (text === undefined) {
        return undefined;
    }
    return text.split("").map(function (element) {
        switch (element) {
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "&":
                return "&amp;";
            case "\"":
                return "&quot;";
            case "'":
                return "&#39;";
        }
        return element;
    }).reduce(function (accum, curr) {
        return accum + curr;
    }, "");
};

module.exports.getIDFromParam = function(idStr) {
    return idStr;
};

module.exports.extToMimeType = function(ext) {
    return mimeTypes.lookup(ext) || undefined;
};

module.exports.mimeTypeToExt = function(mimeType) {
    return mimeTypes.extension(mimeType) || undefined;
};

module.exports.isValidImageType = function(mimeType) {
    switch (mimeType) {
        case "image/gif":
        case "image/png":
        case "image/jpeg":
        case "image/bmp":
            return true;
    }
    return false;
};

module.exports.getValidImageTypes = function() {
    return ["png", "jpeg", "jpg", "bmp", "gif"];
};

module.exports.getValidImageTypesString = function() {
    return this.getValidImageTypes().join(", ");
};

module.exports.createJSONResponseObject = function(status, message) {
    return {
        status,
        message
    };
};

module.exports.sanitizeText = function(text) {
    // TODO:#95 remove sanitizeText
    return text;
};

module.exports.escapeOutput = function(text) {
    return encodeHTML(text);
};

module.exports.getRedirectPath = function(redirectUrl) {
    if (redirectUrl === undefined) {
        return "/";
    }
    var urlObj = url.parse(redirectUrl);
    // check for bad stuff
    if (urlObj.protocol === "javascript:"
        || urlObj.protocol === "vbscript:"
        || urlObj.protocol === "data:"
        || urlObj.pathname.indexOf("//") == 0
        || urlObj.pathname.search("%0D|%0A") >= 0) {
        return "/";
    }
    return urlObj.pathname;
};

if (process.env.NODE_ENV === "test") {
    module.exports.encodeHTML = encodeHTML;
}