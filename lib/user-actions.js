const databaseOps = require("./database-ops");

var authorizeUserImageOperation = function (session, image) {
    return new Promise(function(resolve, reject) {
        // Check if user is authorized to delete this image (ie. user owns it)
        if (session.user && session.user.username === image.username) {
            resolve(image);
        } else {
            // Else, check if we have an unregistered user and there's a match between
            // the unregistered session ID of image and unregistered session ID of session
            // (ie. the unregistered user owns the image)
            if (session.unregisteredSessionID 
                && session.unregisteredSessionID === image.unregisteredSessionID) {
                resolve(image);
            } 
            // Otherwise, reject access
            reject({
                message: "You are not authorized to delete this image."
            });
        }
    });
};

// module.exports.authorizeUserMultiImageOperation = function (session, images) {
//     return new Promise(function(resolve, reject) {

//     });
// };

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

module.exports.userDeleteImages = function (username, imageIDs, callback) {
    databaseOps.findImages(imageIDs, function (err, data) {
        for (var i = 0; i < data.length; i++) {
            if (username !== data[i].username) {
                callback({
                    message: "You are not authorized to delete one or more of these images."
                }, null);
                return;
            }
        }

        databaseOps.deleteImages(imageIDs, function(err, result) {
            callback(err, result);
        });
    });
};