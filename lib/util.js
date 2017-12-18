var mimeTypes = require("mime-types");
var url = require("url");

var encodeHTML = function (text) {
    var final = text.split("").map(function (element) {
        switch (element) {
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "&":
                return "&amp;";
            case "\"\"":
                return "&quot;";
            case "''":
                return "&#39;";
        }
        return element;
    }).reduce(function (accum, curr) {
        return accum + curr;
    });

    return final;
};

var runTextTransformation = function(funcArr, text) {
    var final = text;
    funcArr.forEach(function (func) {
        final = func(final);
    });
    return final;
};

var sanitizeFuncs = [encodeHTML];
var escapeFuncs = [encodeHTML];

module.exports.getIDFromParam = function(idStr) {
    var id = new Number(idStr);
    if (isNaN(id)) {
        return undefined;
    }
    return id.valueOf();
};

module.exports.extToMimeType = function(ext) {
    return mimeTypes.lookup(ext);
};

module.exports.mimeTypeToExt = function(mimeType) {
    return mimeTypes.extension(mimeType);
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