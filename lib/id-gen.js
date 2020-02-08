const databaseOps = require("./database-ops");
const crypto = require("crypto");
const logger = require("./log");

const DEFAULT_ID_LENGTH = 6;
const MAX_COLLISION_COUNT = 10;

var getHashingFunctionName = function(depth) {
    if (depth === 0) {
        return "md5";
    }
    return "sha1";
};

var generateShortIDAndCheck = function(str, callback, length, depth) {
    if (depth === undefined) {
        depth = 0;
    }
    var hash = crypto.createHash(getHashingFunctionName(depth));
    hash.update(str);
    var hashed = hash.digest("hex");
    var shortID = hashed.substr(0, length);

    databaseOps.findImage(shortID, function(err, result) {
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
            if (depth >= (MAX_COLLISION_COUNT - 1)) {
                logger.writeLog("Number of consecutive collisions reached maximum amount, increasing length of id for next try and restarting depth.",
                    logger.SeverityLevel.WARN);
                length++;
                depth = 0;
            }
            generateShortIDAndCheck(hashed, function (err, shortID) {
                if (err) {
                    callback(err, null);
                    return;
                }
                callback(null, shortID);
            }, length, depth + 1);
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
    }, DEFAULT_ID_LENGTH);
};