const databaseOps = require("./database-ops");

var compareUserImageAuthorization = function (session, image) {
    // Check if user is authorized to delete this image (ie. user owns it)
    if (session.user && session.user.username === image.username) {
        return true;
    } else {
        // Else, check if we have an unregistered user and there's a match between
        // the unregistered session ID of image and unregistered session ID of session
        // (ie. the unregistered user owns the image)
        if (session.unregisteredSessionID
            && session.unregisteredSessionID === image.unregisteredSessionID) {
            return true;
        }
        // Otherwise, reject access
        return false;
    }
};

var authorizeUserImageOperation = function (session, image) {
    return new Promise(function(resolve, reject) {
        if (compareUserImageAuthorization(session, image)) {
            resolve(image);
        } else {
            reject({
                message: "You are not authorized to delete this image."
            });
        }
    });
};

var authorizeUserMultiImageOperation = function (session, images) {
    return new Promise(function(resolve, reject) {
        for (var i = 0; i < images.length; i++) {
            if (!compareUserImageAuthorization(session, images[i])) {
                reject({
                    message: "You are not authorized to delete one or more of these images."
                });
            }
        }

        resolve(images);
    });
};

module.exports.userDeleteImage = function (session, imageID, callback) {
    databaseOps.findImage(imageID, function (err, imageEntry) {
        if (err || imageEntry.length == 0) {
            callback({
                message: "Image of this ID does not exist on the database.",
                statusCode: 404
            }, null);
            return;
        } else {
            authorizeUserImageOperation(session, imageEntry[0])
            .then(function(image) {
                databaseOps.deleteImage(imageID, function (err, result) {
                    if (err) {
                        callback(err, null);
                        return;
                    }
                    callback(null, Object.assign(result, {
                        deletedImage: image
                    }));
                });
            })
            .catch(function(err) {
                callback(err, null);
            });
        }
    });
};

module.exports.userDeleteImages = function (session, imageIDs, callback) {
    if (imageIDs.length === 0) {
        callback({
            message: "No images specified for deletion."
        }, null);
        return;
    }

    databaseOps.findImages(imageIDs, function (err, data) {
        if (err || data.length === 0) {
            callback({
                message: "There was an error finding all images of IDs specified."
            }, null);
            return;
        } else {
            authorizeUserMultiImageOperation(session, data)
            .then(function(images) {
                databaseOps.deleteImages(imageIDs, function (err, result) {
                    callback(err, result);
                });
            })
            .catch(function(err) {
                callback(err, null);
            });
        }
    });
};