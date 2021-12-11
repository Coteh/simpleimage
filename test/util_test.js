const assert = require("assert");
const util = require("../lib/util");
const fs = require("fs");
const ObjectID = require("mongodb").ObjectID;
const usernameUtil = require("../lib/util/username");

var testTransform = function(text) {
    return "Transformed";
};

describe("util", function() {
    var imagesArr = [];
    
    before(function() {
        const imageInfoArr = [
            {
                fileName: "Black_tea_pot_cropped.jpg",
                mimeType: "image/jpeg",
                id: "test"
            },
            {
                fileName: "Ingranaggio.png",
                mimeType: "image/png",
                id: "test2"
            },
            {
                fileName: "1525676723.png",
                mimeType: "image/png",
                id: "test3"
            }
        ];
        imageInfoArr.forEach(function(item) {
            var imageFile = fs.readFileSync("./test/assets/images/" + item.fileName + "");
            var expectedImageFileBase64 = fs.readFileSync("./test/assets/images/base64/" + item.fileName + ".txt").toString();
            imagesArr.push(Object.assign({
                imageBuffer: imageFile,
                imageBase64: expectedImageFileBase64
            }, item));
        });
    });

    describe("external functions", function() {
        describe("extToMimeType", function() {
            it("should return a MIME type string given an extension string", function() {
                assert.strictEqual(util.extToMimeType("png"), "image/png");
            });
            it("should return undefined if undefined passed", function() {
                assert.strictEqual(util.extToMimeType(undefined), undefined);
            });
        });
        describe("mimeTypeToExt", function () {
            it("should return an extension string given a MIME type string", function() {
                assert.strictEqual(util.mimeTypeToExt("image/png"), "png");
            });
            it("should return undefined if undefined passed", function () {
                assert.strictEqual(util.mimeTypeToExt(undefined), undefined);
            });
        });
        describe("isValidImageType", function () {
            it("should return true for a valid image type supported by simpleimage", function() {
                assert.strictEqual(util.isValidImageType("image/png"), true);
            });
            it("should return false if an invalid image type is passed", function() {
                assert.strictEqual(util.isValidImageType("application/json"), false);
            });
            it("should return false if undefined is passed", function() {
                assert.strictEqual(util.isValidImageType(undefined), false);
            });
        });
        describe("getValidImageTypes", function () {
            it("should return the image types supported by simpleimage", function() {
                var results = util.getValidImageTypes();
                assert.equal(results.indexOf("png") >= 0, true);
                assert.equal(results.indexOf("jpg") >= 0, true);
                assert.equal(results.indexOf("jpeg") >= 0, true);
                assert.equal(results.indexOf("gif") >= 0, true);
                assert.equal(results.indexOf("bmp") >= 0, true);
            });
        });
        describe("getValidImageTypesString", function () {
            it("should return a string form of the images supported by simpleimage", function() {
                var supportedTypes = ["png", "jpg", "jpeg", "gif", "bmp"];
                var str = util.getValidImageTypesString();
                var strArr = str.split(/, */);
                assert.equal(strArr.length === supportedTypes.length, true);
                var filteredArr = strArr.filter(function(value) {
                    return (supportedTypes.indexOf(value) === -1);
                });
                assert.equal(filteredArr.length === 0, true);
            });
        });
        describe("escapeOutput", function () {
            it("should escape text with HTML special characters", function () {
                assert.strictEqual(util.escapeOutput("<>&\"'"), "&lt;&gt;&amp;&quot;&apos;");
            });
            it("should return empty string if empty string passed in", function () {
                assert.strictEqual(util.escapeOutput(""), "");
            });
            it("should return empty string if undefined passed in", function () {
                assert.strictEqual(util.escapeOutput(undefined), "");
            });
        });
        describe("getRedirectPath", function () {
            it("should return a relative path string given a production url", function() {
                var myURL = "https://www.simpleimage.com/images/test";
                assert.strictEqual(util.getRedirectPath(myURL), "/images/test");
            });
            it("should return root path string given undefined as url", function () {
                assert.strictEqual(util.getRedirectPath(undefined), "/");
            });
            it("should return root slash if root slash is given", function() {
                var path = "/";
                assert.strictEqual(util.getRedirectPath(path), path);
            });
            it("should return the same string if relative path already given", function() {
                var path = "/my_path";
                assert.strictEqual(util.getRedirectPath(path), path);
            });
            it("should strip out queries from the URL", function() {
                assert.strictEqual(util.getRedirectPath("/index.html?query=something"), "/index.html");
            });
            it("should return just the relative path if malicious URL is provided", function() {
                assert.strictEqual(util.getRedirectPath("http://evilsite.com/foo/bar?somequery=value"), "/foo/bar");
            });
            it("should block relative paths with two (or more) slashes in front", function() {
                assert.strictEqual(util.getRedirectPath("//google.com"), "/");
            });
            it("should block javascript: protocol URLs", function() {
                assert.strictEqual(util.getRedirectPath("javascript:alert(1)"), "/");
            });
            it("should block data: protocol URLs", function() {
                assert.strictEqual(util.getRedirectPath("data:text/html,<script>alert(document.domain)</script>"), "/");
            });
            it("should block vbscript: protocol URLs", function () {
                assert.strictEqual(util.getRedirectPath("vbscript:myfunction(total)"), "/");
            });
            it("should block URLs with CRLF characters", function() {
                assert.strictEqual(util.getRedirectPath("/index\r\nsomething"), "/");
            });
        });
        describe("convertImageBinaryToBase64", function () {
            it("should convert binary image data to base64 equivalent", function() {
                var image = imagesArr[0];
                var imageFile = image.imageBuffer;
                var expectedImageFileBase64 = image.imageBase64;

                var actualImageFileBase64 = util.convertImageBinaryToBase64(imageFile);

                assert.equal(actualImageFileBase64, expectedImageFileBase64, "The base64 strings don't match.");
            });
            it("should return undefined if undefined is passed as binary image data", function() {
                var imageBase64 = util.convertImageBinaryToBase64(undefined);

                assert.equal(imageBase64, undefined);
            });
            it("should return undefined if null is passed as binary image data", function () {
                var imageBase64 = util.convertImageBinaryToBase64(null);

                assert.equal(imageBase64, undefined);
            });
        });
        describe("constructBase64ImageArray", function() {
            it("should construct a set of base64 images (data + info) given array of image info from DB", function() {
                var dbImages = imagesArr.map(function(item, index) {
                    return {
                        data: item.imageBuffer,
                        mimetype: item.mimeType,
                        id: item.id,
                        encoding: "7bit",
                        uploadeddate: new Date(0),
                        _id: new ObjectID(index.toString().padStart(24, "a"))
                    }
                });

                var base64Images = util.constructBase64ImageArray(dbImages);
                
                assert.equal(base64Images.length, dbImages.length);
                for (var i = 0; i < base64Images.length; i++) {
                    assert.equal(base64Images[i].data, imagesArr[i].imageBase64);
                    assert.equal(base64Images[i].mimeType, imagesArr[i].mimeType);
                    assert.equal(base64Images[i].id, imagesArr[i].id);
                }
            });
            it("should return undefined if undefined is passed as array of image info", function () {
                var base64Images = util.constructBase64ImageArray(undefined);

                assert.equal(base64Images, undefined);
            });
            it("should return undefined if null is passed as array of image info", function () {
                var base64Images = util.constructBase64ImageArray(null);

                assert.equal(base64Images, undefined);
            });
            it("should return an array of 0 images if an array of 0 image infos is passed in", function() {
                var base64Images = util.constructBase64ImageArray([]);

                assert.ok(base64Images);
                assert.equal(base64Images.length, 0);
            });
        });
    });

    describe("username utils", function () {
        describe("isValidUsername", function () {
            it("should pass a valid username", function () {
                const result = usernameUtil.isValidUsername("testuser");
                assert.ok(result.valid);
                assert.strictEqual(result.error, null);
            });
            it("should reject a username that is too long", function () {
                const oldMaxUsernameLength = process.env.MAX_USERNAME_LENGTH || 24;
                process.env.MAX_USERNAME_LENGTH = 24;
                const result = usernameUtil.isValidUsername("thisisaveryveryveryveryveryveryverylongusername");
                assert.strictEqual(result.valid, false);
                assert.strictEqual(result.error, usernameUtil.UsernameError.USERNAME_TOO_LONG);
                process.env.MAX_USERNAME_LENGTH = oldMaxUsernameLength;
            });
            it("should reject a username that is not a string", function () {
                const result = usernameUtil.isValidUsername(["multiple", "usernames", "should", "not", "work"]);
                assert.strictEqual(result.valid, false);
                assert.strictEqual(result.error, usernameUtil.UsernameError.USERNAME_NOT_STRING);
            });
        });
    });
});
