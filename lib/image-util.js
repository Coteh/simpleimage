const piexifjs = require("piexifjs");
const exif = require("exif");
const { spawn } = require("child_process");
const fs = require("fs");
const ExifImage = exif.ExifImage;
const logger = require("./logger").logger;

var tmpPath = "/tmp";

// TODO improve this function to decrease the odds of collision
var getTempImageID = function () {
    var randNum = Math.floor(Math.random() * Math.floor(10000));
    var currTimeMS = new Date().getTime();
    return randNum.toString() + "-" + currTimeMS.toString();
};

module.exports.rotateImageEntry = function (imageEntry) {
    return new Promise(function (resolve, reject) {
        if (!imageEntry) {
            reject({
                code: "IMG_ENTRY_NULL",
                message: "ImageEntry supplied for image rotation is null/undefined."
            });
            return;
        }
        if (!imageEntry.data) {
            reject({
                code: "IMG_NULL",
                message: "Image data supplied for image rotation is null/undefined."
            });
            return;
        }

        var tempFilePath = tmpPath + "/img-" + getTempImageID() + ".jpg";
        fs.writeFileSync(tempFilePath, imageEntry.data);

        var fd = fs.openSync(tempFilePath, 'r');
        var testBuffer = new Buffer(2);
        var bytesRead = fs.readSync(fd, testBuffer, 0, 2, 0);
        if (bytesRead != 2) {
            console.error("error reading");
        }
        console.log(testBuffer);

        var errMessage = null;
        var errCode = null;
        const exiftran = spawn("exiftran", ["-a", "-i", tempFilePath]);
        exiftran.stdout.on("data", function (data) {
            if (process.env.NODE_ENV === "development") {
                logger.info(`exiftran stdout: ${data}`);    
            }
        });
        exiftran.stderr.on("data", function (data) {
            if (process.env.NODE_ENV === "development") {
                logger.info(`exiftran stderr: ${data}`);    
            }
            errMessage = data.toString();
            console.log("err -> " + errMessage);
            if (errMessage.includes("Not a JPEG file")) {
                errCode = "NOT_A_JPEG";
            } else {
                errCode = "IMG_ROTATION_ERROR";
            }
        });
        exiftran.on("close", function (code) {
            // if (process.env.NODE_ENV === "development") {
                logger.info("exiftran rc: " + code);    
            // }
            if (code == 0) {
                const file = fs.readFileSync(tempFilePath);
                logger.info(file.slice(0, 2).toString("hex"));
                resolve(file);
            } else {
                reject({
                    code: errCode,
                    message: errMessage
                });
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