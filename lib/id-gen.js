const ImageDatabase = require("./ImageDatabase");
const crypto = require("crypto");
const logger = require("./log");

var getHashingFunctionName = function(depth) {
    if (depth === 0) {
        return "md5";
    }
    return "sha1";
};

var generateShortIDAndCheck = function(str, callback, depth) {
    if (depth === undefined) {
        depth = 0;
    }
    hash = crypto.createHash(getHashingFunctionName(depth));
    hash.update(str);
    var hashed = hash.digest("hex");
    var shortID = hashed.substr(0, 6);

    ImageDatabase.findImage(shortID, function(err, result) {
        if (err) {
            callback(err, null);
            return;
        }
        if (result.length === 0) { //no currently existing entries with ID
            callback(null, shortID);
        } else { //entry already exists with ID, retry with full hashed string
            logger.writeLog("There was a collision with short ID generation using string '" 
                            + str + "'. Trying again with hashed string '" + hashed + "'.",
                            logger.SeverityLevel.WARN);
            generateShortIDAndCheck(hashed, function(err, shortID) {
                if (err) {
                    callback(err, null);
                    return;
                }
                callback(null, shortID);
            }, depth + 1);
        }
    });
};

module.exports.generateShortIDFromObjectID = function(objectID, callback) {
    generateShortIDAndCheck(objectID.toHexString(), function(err, shortID) {
        if (err) {
            callback(err, null);
            return;
        }
        callback(null, shortID);
    });
};