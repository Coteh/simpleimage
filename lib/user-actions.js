const databaseOps = require("./database-ops");

var compareUserImageAuthorization = function (session, image) {
    if (!session) {
        throw new Error("Session is missing");
    }
    if (!image) {
        throw new Error("Image is missing");
    }
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
                message: "You are not authorized to perform operations on this image."
            });
        }
    });
};

var authorizeUserMultiImageOperation = function (session, images) {
    return new Promise(function(resolve, reject) {
        if (!images) {
            reject({
                message: "Error occurred when verifying user operations on images."
            });
            return;
        }

        if (!images.length || images.length === 0) {
            reject({
                message: "There are no image operations to be authenticated."
            });
            return;
        }

        for (var i = 0; i < images.length; i++) {
            if (!compareUserImageAuthorization(session, images[i])) {
                reject({
                    message: "You are not authorized to perform operations on one or more of these images."
                });
                return;
            }
        }

        resolve(images);
    });
};

module.exports.transferGuestImageToUser = function (session, imageID) {
    return new Promise(function (resolve, reject) {
        databaseOps.findImage(imageID, function (err, imagesArr) {
            if (err || imagesArr.length === 0) {
                reject({
                    message: "Image of this ID does not exist on the database.",
                    statusCode: 404
                });
            } else {
                authorizeUserImageOperation(session, imagesArr[0])
                    .then(function (image) {
                        databaseOps.transferUnregisteredUserImageToRegisteredUser(imageID, session.user.username)
                            .then(function (result) {
                                resolve({
                                    message: "Image of ID " + imageID + " has been transferred to user " + session.user.username + " successfully.",
                                    result
                                });
                            })
                            .catch(function (err) {
                                reject(err);
                            });
                    })
                    .catch(function (err) {
                        reject(err);
                    });
            }
        });
    });
};

module.exports.transferGuestImageMultiToUser = function (session, imageIDs) {
    return new Promise(function (resolve, reject) {
        if (imageIDs.length === 0) {
            reject({
                message: "No images specified for deletion."
            });
            return;
        }

        databaseOps.findImages(imageIDs, function (err, data) {
            if (err || data.length === 0) {
                reject({
                    message: "There was an error finding all images of IDs specified."
                });
                return;
            } else {
                authorizeUserMultiImageOperation(session, data)
                    .then(function (images) {
                        databaseOps.transferUnregisteredUserImageMultiToRegisteredUser(imageIDs, session.user.username)
                            .then(function (result) {
                                resolve({
                                    message: "Images have been transferred to user " + session.user.username + " successfully.",
                                });
                            })
                            .catch(function (err) {
                                reject(err);
                            });
                    })
                    .catch(function (err) {
                        reject(err);
                    });
            }
        });
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

if (process.env.NODE_ENV === "test") {
    module.exports.compareUserImageAuthorization = compareUserImageAuthorization;
    module.exports.authorizeUserImageOperation = authorizeUserImageOperation;
    module.exports.authorizeUserMultiImageOperation = authorizeUserMultiImageOperation;
}