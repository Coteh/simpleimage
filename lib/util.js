var mimeTypes = require("mime-types");
var url = require("url");

var encodeHTML = function (text) {
    if (text === undefined) {
        return undefined;
    }
    var final = text.split("").map(function (element) {
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
    });

    return final;
};

var runTextTransformation = function(funcArr, text) {
    if (funcArr === undefined) {
        return undefined;
    }
    var final = text;
    funcArr.forEach(function (func) {
        final = func(final);
    });
    return final;
};

var sanitizeFuncs = [encodeHTML];
var escapeFuncs = [];

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
    return runTextTransformation(sanitizeFuncs, text);
};

module.exports.escapeOutput = function(text) {
    return runTextTransformation(escapeFuncs, text);
};

module.exports.getRedirectPath = function(redirectUrl) {
    if (redirectUrl === undefined) {
        return "/";
    }
    var urlObj = url.parse(redirectUrl);
    if (urlObj.host !== null) {
        return "/";
    }
    switch (urlObj.pathname) {
        case "home":
            return "/";
        default:
            return urlObj.path;
    }
};

module.exports.convertImageBinaryToBase64 = function(imgBin) {
    if (!imgBin) {
        return undefined;
    }
    return Buffer.from(imgBin).toString("base64");
};

module.exports.constructBase64ImageArray = function(imgArr) {
    if (!imgArr) {
        return undefined;
    }
    var base64Images = [];
    imgArr.forEach(function (imageData) {
        base64Images.push({
            mimeType: imageData.mimetype,
            data: module.exports.convertImageBinaryToBase64(imageData.data.buffer),
            id: imageData.id
        });
    });
    return base64Images;
};

if (process.env.NODE_ENV === "test") {
    module.exports.encodeHTML = encodeHTML;
    module.exports.runTextTransformation = runTextTransformation;
}