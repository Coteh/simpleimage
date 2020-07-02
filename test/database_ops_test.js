const assert = require("assert");
const rewire = require("rewire");
const testImageDB = require("./util/test-image-db");
const testImageUtils = require("./util/test-image-utils");

var mongoStub = {
    imageEntryCollection: {
        updateMany: function (selector, operations, callback) {
            if (operations.$set) {
                if (!selector.id) {
                    callback({
                        message: "Non-ID selection not supported in this test environment."
                    }, null);
                    return;
                }
                testImageDB.updateManyImages(selector.id.$in, operations.$set);
                callback(null, {
                    ok: 1
                });
            } else {
                callback({
                    message: "Any other operation is not supported in this test environment."
                }, null);
            }
        }
    }
};

const databaseOps = rewire("../lib/database-ops");
databaseOps.__set__(mongoStub);

describe("transferUnregisteredUserImagesToRegisteredUser", function () {
    before(function () {
        testImageDB.clearImages();
    });
    it("should set username on each image", function (done) {
        var testImages = testImageUtils.createTestImages({
            unregisteredSessionID: "qwertyuiop"
        }, 5);
        testImageDB.addImages(testImages);
        var testImageIDs = testImages.map(function (image) {
            return image.id;
        });
        databaseOps.transferUnregisteredUserImagesToRegisteredUser(testImageIDs, "james")
            .then(function (result) {
                assert.ok(result);
            })
            .catch(function (err) {
                assert.fail(err.stack || err.message);
            })
            .then(done, done);
    });
    it("should remove unregistered session ID from each image", function (done) {
        assert.fail("Not implemented yet");
    });
    it("should throw if undefined imageIDs is passed");
    it("should throw if null imageIDs is passed");
    it("should throw if undefined username is passed");
    it("should throw if null username is passed");
});