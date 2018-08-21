const piexifjs = require("piexifjs");
const exif = require("exif");
const { spawn } = require("child_process");
const fs = require("fs");
const ExifImage = exif.ExifImage;

// TODO improve this function to decrease the odds of collision
var getTempImageID = function () {
    var randNum = Math.floor(Math.random() * Math.floor(10000));
    var currTimeMS = new Date().getTime();
    return randNum.toString() + "-" + currTimeMS.toString();
}

module.exports.rotateImageEntry = function (imageEntry) {
    return new Promise(function (resolve, reject) {
        var tempFilePath = "/tmp/img-" + getTempImageID() + ".jpg";
        fs.writeFileSync(tempFilePath, imageEntry.data);
        exiftran = spawn("exiftran", ["-a", "-i", tempFilePath]);
        exiftran.stdout.on("data", function (data) {
            console.log(`stdout: ${data}`);
        });
        exiftran.stderr.on("data", function (data) {
            console.log(`stderr: ${data}`);
        });
        exiftran.on("close", function (code) {
            console.log("rc: " + code);
            if (code == 0) {
                file = fs.readFileSync(tempFilePath);
                resolve(file);
            } else {
                reject("Image rotation error.");
            }
        });
    });
};

module.exports.removeEXIFDataFromImageEntry = function (imageEntry) {
    return new Promise(function (resolve, reject) {
        if (!imageEntry) {
            reject({
                message: "No image entry provided."
            });
            return;
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
        if (!imageEntry) {
            reject({
                message: "No image entry provided."
            });
            return;
        }
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