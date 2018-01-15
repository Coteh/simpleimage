const assert = require("assert");
const util = require("../lib/util");

var testTransform = function(text) {
    return "Transformed";
};

describe("util", function() {
    describe("internal functions", function() {
        describe("encodeHTML", function () {
            it("should encode '<', '>', and '&' characters", function () {
                assert.strictEqual(util.encodeHTML("<>&"), "&lt;&gt;&amp;");
            });
            it("should encode single quote and double quote characters", function () {
                assert.strictEqual(util.encodeHTML("'\""), "&#39;&quot;");
            });
            it("should return undefined if undefined is passed in as the string", function () {
                assert.strictEqual(util.encodeHTML(undefined), undefined);
            });
        });

        describe("runTextTransformation", function () {
            it("should run a transformation function on given text", function() {
                var funcArr = [testTransform];
                assert.strictEqual(util.runTextTransformation(funcArr, "Test"), "Transformed");
            });
            it("should return the input text if empty function array passed", function () {
                assert.strictEqual(util.runTextTransformation([], "Test"), "Test");
            });
            it("should return undefined if undefined is passed in as function array", function () {
                assert.strictEqual(util.runTextTransformation(undefined, "Test"), undefined);
            });
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
                assert.fail("Not implemented");
            });
        });
        describe("getValidImageTypesString", function () {
            it("should return a string form of the images supported by simpleimage", function() {
                assert.fail("Not implemented");
            });
        });
        describe("createJSONResponseObject", function () {
            it("should create an object containing passed in status and message", function() {
                assert.fail("Not implemented");
            });
            it("should have a status of 'error' if undefined passed as status", function() {
                assert.fail("Not implemented");
            });
            it("should not contain a message property if undefined passed as message", function() {
                assert.fail("Not implemented");
            });
        });
        describe("sanitizeText", function () {
            it("should sanitize input text", function() {
                assert.fail("Not implemented");
            });
            it("should return empty string if empty string passed in", function() {
                assert.fail("Not implemented");
            });
            it("should return undefined if undefined passed in", function() {
                assert.fail("Not implemented");
            });
        });
        describe("escapeOutput", function () {
            it("should escape output text", function () {
                assert.fail("Not implemented");
            });
            it("should return empty string if empty string passed in", function () {
                assert.fail("Not implemented");
            });
            it("should return undefined if undefined passed in", function () {
                assert.fail("Not implemented");
            });
        });
        describe("getRedirectPath", function () {
            it("should return a relative path string given a production url", function() {
                assert.fail("Not implemented");
            });
            it("should return root path string given 'home' string as url", function() {
                assert.fail("Not implemented");
            });
            it("should return root path string given undefined as url", function () {
                assert.fail("Not implemented");
            });
        });
    });
});









