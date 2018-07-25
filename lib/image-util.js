var piexifjs = require("piexifjs");
var exif = require("exif");
const ExifImage = exif.ExifImage;

module.exports.rotateImageEntry = function (imageEntry) {
    throw new Error("Not implemented");
};

module.exports.removeEXIFDataFromImageEntry = function (imageEntry) {
    return new Promise(function (resolve, reject) {
        if (!imageEntry) {
            reject({
                message: "No image entry provided."
            });
        }
        try {
            var modifiedImage = piexifjs.remove(imageEntry.data.toString("binary"));
            imageEntry.data = Buffer.from(modifiedImage, "binary");
            resolve(imageEntry);
        } catch (err) {
            reject({
                message: err
            });
        }
    });
};

module.exports.checkForEXIFImageEntry = function (imageEntry) {
    return new Promise(function (resolve, reject) {
        if (imageEntry.mimetype !== "image/jpeg") {
            reject({
                message: "Not a JPEG",
                code: "NOT_A_JPEG"
            });
            return;
        }
        try {
            new ExifImage({ image: imageEntry.data }, function (err, exifData) {
                if (err) {
                    reject(err);
                } else {
                    resolve(exifData);
                }
            });
        } catch (err) {
            reject(err);
        }
    });
};