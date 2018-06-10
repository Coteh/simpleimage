const ObjectID = require("mongodb").ObjectID;

module.exports.createRegisteredUserSession = function (username = "testuser") {
    return {
        user: {
            username,
            email: username + "@email.com"
        }
    };
};

module.exports.createUnregisteredUserSession = function (unregisteredSessionID = "zxcvbnm") {
    return {
        unregisteredSessionID
    };
};

module.exports.createRegisteredUserSessionWithUnregisteredSession = function (username, unregisteredSessionID) {
    return Object.assign(module.exports.createUnregisteredUserSession(unregisteredSessionID), module.exports.createRegisteredUserSession(username));
};

module.exports.createTestImage = function (options) {
    if (!options) {
        options = {};
    }
    return {
        _id: new ObjectID((options.index ? options.index : 0).toString().padStart(24, "0")),
        encoding: "7bit",
        uploadeddate: new Date(0),
        data: new Buffer(0),
        mimetype: "image/png",
        id: options.id || "abcdef",
        username: options.username,
        unregisteredSessionID: options.unregisteredSessionID
    };
};

module.exports.createTestImages = function (optionsArr, length) {
    if (!optionsArr) {
        return undefined;
    }
    if (typeof optionsArr === "number") {
        var length = optionsArr;
        optionsArr = new Array(length);
        for (var i = 0; i < length; i++) {
            optionsArr[i] = {};
        }
    } else if (optionsArr instanceof Array) {
        if (optionsArr.length === 0) {
            return [];
        }
    } else {
        if (!length) {
            return undefined;
        }
        var options = optionsArr;
        optionsArr = new Array(length);
        for (var i = 0; i < length; i++) {
            optionsArr[i] = options;
        }
    }
    return optionsArr.map(function (options, index) {
        return module.exports.createTestImage(Object.assign({
            index,
            id: index.toString().padStart(6, "0")
        }, options));
    });
};