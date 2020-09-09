const assert = require("assert");
const piexifjs = require("piexifjs");
const proxyquire = require("proxyquire");
const fs = require("fs");
const { EventEmitter } = require("events");
const { spawn } = require("child_process");

const childProcessStub = {};
const imageUtil = proxyquire("../lib/image-util", {
    "child_process": childProcessStub,    
});

describe("rotateImageEntry", function () {
    it("should rotate an EXIF image to standard orientation (orientation value 1)", function () {
        var imageEntry = {
            data: fs.readFileSync("./test/assets/images/EXIF_rotate_test.jpg"),
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.rotateImageEntry(imageEntry)
            .then(function (imageData) {
                imageEntry.data = imageData;
                return imageUtil.checkForEXIFImageEntry(imageEntry)
                    .then(function (exifData) {
                        assert.strictEqual(exifData.image.Orientation, 1);
                    })
                    .catch(function (err) {
                        throw new Error("Error reading EXIF data from rotated image. Error message: " + err.message);
                    });
            })
            .catch(function (err) {
                throw err;
            });
    });
    it("should not alter the image data of a non-EXIF image", function () {
        var imageEntry = {
            data: fs.readFileSync("./test/assets/images/EXIF_removed.jpg"),
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.rotateImageEntry(imageEntry)
            .then(function (data) {
                var newData = data;
                var oldData = imageEntry.data;
                assert.strictEqual(oldData.compare(newData, newData.indexOf("FFDA", 0, "hex"), newData.length, oldData.indexOf("FFDA", 0, "hex"), oldData.length), 0)
            })
            .catch(function (err) {
                throw err;
            });
    });
    it("should throw an error if attempting to rotate a null image", function () {
        var imageEntry = {
            data: null,
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.rotateImageEntry(imageEntry)
            .then(function (data) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.code, "IMG_NULL", err.message);
            });
    });
    it("should throw an error if attempting to rotate an undefined image", function () {
        var imageEntry = {
            data: undefined,
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.rotateImageEntry(imageEntry)
            .then(function (data) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.code, "IMG_NULL", err.message);
            });
    });
    it("should throw an error if a null image entry is passed in", function () {
        return imageUtil.rotateImageEntry(null)
            .then(function (data) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.code, "IMG_ENTRY_NULL", err.message);
            });
    });
    it("should throw an error if an undefined image entry is passed in", function () {
        return imageUtil.rotateImageEntry(undefined)
            .then(function (data) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.code, "IMG_ENTRY_NULL", err.message);
            });
    });
    it('should throw an error if spawning EXIF remover process ran into an error', function () {
        let spawnStub = new EventEmitter();
        spawnStub.stdout = new EventEmitter();
        spawnStub.stderr = new EventEmitter();
        childProcessStub.spawn = () => {
            return spawnStub;
        };
        var imageEntry = {
            data: fs.readFileSync("./test/assets/images/EXIF_rotate_test.jpg"),
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        let promise = imageUtil.rotateImageEntry(imageEntry)
            .then(function (data) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.code, "EXIF_REMOVE_ERROR", err.message);
            });

        spawnStub.emit("error", {
            message: "some error"
        });

        return promise;
    });
    afterEach(() => {
        childProcessStub.spawn = spawn;
    });
});

describe("removeEXIFDataFromImageEntry", function () {
    it("should strip out EXIF data from JPEG image entries", function () {
        var imageEntry = {
            data: fs.readFileSync("./test/assets/images/EXIF_test.jpg"),
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.removeEXIFDataFromImageEntry(imageEntry)
            .then(function (imageEntry) {
                try {
                    var exifInfo = piexifjs.load(imageEntry.data.toString("binary"));
                    var expectedDict = {
                        "0th": {},
                        "Exif": {},
                        "GPS": {},
                        "Interop": {},
                        "1st": {},
                        "thumbnail": null
                    };
                    assert.deepStrictEqual(exifInfo, expectedDict, "EXIF data still found in image");
                } catch (err) {
                    assert.fail(err);
                }
            })
            .catch(function (err) {
                throw new Error(err.message);
            });
    });
    it("should throw an error if attempting to strip data from non-JPEG image entries", function () {
        var imageEntry = {
            data: fs.readFileSync("./test/assets/images/NonJPEG_image.png"),
            mimetype: "image/png",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.removeEXIFDataFromImageEntry(imageEntry)
            .then(function (imageEntry) {
                assert.fail("This image is a PNG, not a JPEG. No EXIF data should have been stripped.");
            })
            .catch(function (err) {
                assert.strictEqual(err.message, "Given data is not jpeg.");
            });
    });
    it("should not change the image data if EXIF has been stripped from JPEG image entry already", function () {
        var imageData = fs.readFileSync("./test/assets/images/EXIF_removed.jpg");
        var imageEntry = {
            data: imageData,
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.removeEXIFDataFromImageEntry(imageEntry)
            .then(function (imageEntry) {
                var newData = imageData;
                var oldData = imageEntry.data;
                assert.strictEqual(oldData.compare(newData, newData.indexOf("FFDA", 0, "hex"), newData.length, oldData.indexOf("FFDA", 0, "hex"), oldData.length), 0)
            })
            .catch(function (err) {
                throw new Error(err.message);
            });
    });
    it("should throw an error if attempting to strip data from null image entry argument", function () {
        return imageUtil.removeEXIFDataFromImageEntry(null)
            .then(function (imageEntry) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.message, "No image entry provided.", err.message);
            });
    });
    it("should throw an error if attempting to strip data from undefined image entry argument", function () {
        return imageUtil.removeEXIFDataFromImageEntry(undefined)
            .then(function (imageEntry) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.message, "No image entry provided.", err.message);
            });
    });
});

describe("checkForEXIFImageEntry", function () {
    it("should pass if EXIF data is found in JPEG image entry", function () {
        var imageEntry = {
            data: fs.readFileSync("./test/assets/images/EXIF_test.jpg"),
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.checkForEXIFImageEntry(imageEntry)
            .then(function (data) {
                assert.ok(Object.keys(data.exif).length > 0);
            })
            .catch(function (err) {
                assert.fail(err.message);
            });
    });
    it("should fail for non-JPEG image entries", function () {
        var imageEntry = {
            data: fs.readFileSync("./test/assets/images/NonJPEG_image.png"),
            mimetype: "image/png",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.checkForEXIFImageEntry(imageEntry)
            .then(function (data) {
                assert.fail("PNG image should not have passed the EXIF check.");
            })
            .catch(function (err) {
                assert.strictEqual(err.code, "NOT_A_JPEG");
            });
    });
    it("should fail for non-JPEG image entries that are mistakenly labelled with a JPEG mimetype", function () {
        var imageEntry = {
            data: fs.readFileSync("./test/assets/images/NonJPEG_image.png"),
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.checkForEXIFImageEntry(imageEntry)
            .then(function (data) {
                assert.fail("PNG image should not have passed the EXIF check.");
            })
            .catch(function (err) {
                assert.strictEqual(err.code, "NOT_A_JPEG");
            });
    });
    it("should fail for image entries with stripped out EXIF data", function () {
        var imageEntry = {
            data: fs.readFileSync("./test/assets/images/EXIF_removed.jpg"),
            mimetype: "image/jpeg",
            encoding: "7bit",
            username: "TestUser"
        };

        return imageUtil.checkForEXIFImageEntry(imageEntry)
            .then(function (data) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.message, "No Exif segment found in the given image.", err.message);
            });
    });
    it("should fail for null image entries", function () {
        return imageUtil.checkForEXIFImageEntry(null)
            .then(function (data) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.message, "No image entry provided.", err.message);
            });
    });
    it("should fail for undefined image entries", function () {
        return imageUtil.checkForEXIFImageEntry(undefined)
            .then(function (data) {
                assert.fail("This should not succeed. Failing...");
            })
            .catch(function (err) {
                assert.strictEqual(err.message, "No image entry provided.", err.message);
            });
    });
});