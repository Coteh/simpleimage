const databaseOps = require("./database-ops");

module.exports.userDeleteImage = function (username, imageID, callback) {
    databaseOps.findImage(imageID, function (err, imageEntry) {
        if (err || imageEntry.length == 0) {
            callback({
                message: "Image of this ID does not exist on the database.",
                statusCode: 404
            }, null);
            return;
        } else {
            if (imageEntry[0].username !== username) {
                callback({
                    message: "You are not authorized to delete this image."
                }, null);
                return;
            }
            databaseOps.deleteImage(imageID, function (err, result) {
                if (err) {
                    callback(err, null);
                    return;
                }
                callback(null, Object.assign(result, {
                    deletedImage: imageEntry[0]
                }));
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