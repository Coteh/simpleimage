const assert = require("assert");
const proxyquire = require("proxyquire");
const testImageUtils = require("./util/test-image-utils");

var databaseOpsStub = {};

const userActions = proxyquire("../lib/user-actions", { "./database-ops": databaseOpsStub });

describe("user actions", function() {
    describe("compareUserImageAuthorization", function () {
        it("should return true if username on image is equal to username on session", function () {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImage = testImageUtils.createTestImage({
                username: "james"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), true);
        });
        it("should return false if username on image is not equal to username on session", function () {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImage = testImageUtils.createTestImage({
                username: "dude"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return true if unregistered session ID on image is equal to unregistered session ID on session", function () {
            var session = testImageUtils.createUnregisteredUserSession("qwertyuiop");
            var testImage = testImageUtils.createTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), true);
        });
        it("should return false if unregistered session ID on image is not equal to unregistered session ID on session", function () {
            var session = testImageUtils.createUnregisteredUserSession("qwertyuiop");
            var testImage = testImageUtils.createTestImage({
                unregisteredSessionID: "asdfghjkl"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return false if a unregistered user session is used to verify operation on an image uploaded by a registered user", function () {
            var session = testImageUtils.createUnregisteredUserSession("qwertyuiop");
            var testImage = testImageUtils.createTestImage({
                username: "dude"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return false if a registered user session is used to verify operation on an image uploaded anonymously", function () {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImage = testImageUtils.createTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return true if a registered user session with unregistered session ID is used to verify operation "
            + "on an image uploaded anonymously with same unregistered session ID", function () {
                var session = testImageUtils.createRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImage = testImageUtils.createTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), true);
        });
        it("should throw if session is undefined", function () {
            var testImage = testImageUtils.createTestImage({
                username: "james"
            });
            assert.throws(function() {
                userActions.compareUserImageAuthorization(undefined, testImage);
            }, function(err) {
                return (err instanceof Error && err.message === "Session is missing")
            });
        });
        it("should throw if session is null", function () {
            var testImage = testImageUtils.createTestImage({
                username: "james"
            });
            assert.throws(function() {
                userActions.compareUserImageAuthorization(null, testImage);
            }, function(err) {
                return (err instanceof Error && err.message === "Session is missing")
            });
        });
        it("should throw if image is undefined", function () {
            var session = testImageUtils.createRegisteredUserSession();
            assert.throws(function() {
                userActions.compareUserImageAuthorization(session, undefined);
            }, function(err) {
                return (err instanceof Error && err.message === "Image is missing")
            });
        });
        it("should throw if image is null", function () {
            var session = testImageUtils.createRegisteredUserSession();
            assert.throws(function() {
                userActions.compareUserImageAuthorization(session, null);
            }, function(err) {
                return (err instanceof Error && err.message === "Image is missing")
            });
        });
        it("should return false if session is an empty object", function () {
            var session = {};
            var testImage = testImageUtils.createTestImage({
                username: "james"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return false if image is an empty object", function () {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImage = {};
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
    });
    describe("authorizeUserImageOperation", function() {
        it("users can operate on their own image", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImage = testImageUtils.createTestImage({
                username: "james"
            });
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.ok(image);
                })
                .catch(function (err) {
                    assert.fail(err.message);
                })
                .then(done, done);
        });
        it("users cannot operate on another user's image", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImage = testImageUtils.createTestImage({
                username: "jake"
            });
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("User was able to operate on another user's image, but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.", err.message);
                })
                .then(done, done);
        });
        it("guests can operate on their own image", function (done) {
            var session = testImageUtils.createUnregisteredUserSession("qwertyuiop");
            var testImage = testImageUtils.createTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.ok(image);
                })
                .catch(function (err) {
                    assert.fail(err.message);
                })
                .then(done, done);
        });
        it("guests cannot operate on other guests' image", function (done) {
            var session = testImageUtils.createUnregisteredUserSession("qwertyuiop");
            var testImage = testImageUtils.createTestImage({
                unregisteredSessionID: "asdfghjkl"
            });
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("Guest was able to operate on another guest's image, but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.", err.message);
                })
                .then(done, done);
        });
        it("guests cannot operate on a registered user's image", function (done) {
            var session = testImageUtils.createUnregisteredUserSession("qwertyuiop");
            var testImage = testImageUtils.createTestImage({
                username: "james"
            });
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("Guest was able to operate on a registered user's image, but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.", err.message);
                })
                .then(done, done);
        });
        it("registered users cannot operate on guests' image (guests besides themselves)", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImage = testImageUtils.createTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("Registered user was able to operate on a guest's image (a guest besides themselves), "
                        + "but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.", err.message);
                })
                .then(done, done);
        });
        it("registered users can operate on image they uploaded as a guest", function (done) {
            var session = testImageUtils.createRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImage = testImageUtils.createTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.ok(image);
                })
                .catch(function (err) {
                    assert.fail(err.message);
                })
                .then(done, done);
        });
        it("should throw if session is undefined", function (done) {
            var testImage = testImageUtils.createTestImage({
                username: "james"
            });
            userActions.authorizeUserImageOperation(undefined, testImage)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if session is null", function (done) {
            var testImage = testImageUtils.createTestImage({
                username: "james"
            });
            userActions.authorizeUserImageOperation(null, testImage)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if image is undefined", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            userActions.authorizeUserImageOperation(session, undefined)
                .catch(function (err) {
                    assert.equal(err.message, "Image is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if image is null", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            userActions.authorizeUserImageOperation(session, null)
                .catch(function (err) {
                    assert.equal(err.message, "Image is missing", err.message);
                })
                .then(done, done);
        });
        it("should not authorize any operation if session provided is an empty object", function (done) {
            var session = {};
            var testImage = testImageUtils.createTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("This should not be allowed to happen.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.", err.message);
                })
                .then(done, done);
        });
        it("should not authorize any operation if image provided is an empty object", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImage = {};
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("This should not be allowed to happen.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.", err.message);
                })
                .then(done, done);
        });
    });
    describe("authorizeUserMultiImageOperation", function () {
        it("users can operate on their own images", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImages = testImageUtils.createTestImages({
                username: "james"
            }, 5);
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.ok(image);
                })
                .catch(function (err) {
                    assert.fail(err.message);
                })
                .then(done, done);
        });
        it("users cannot operate on other users' images", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImages = testImageUtils.createTestImages([
                {
                    username: "james"
                },
                {
                    username: "jake"
                }
            ]);
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.fail("Registered user was able to operate on another registered user's image, "
                        + "but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on one or more of these images.", err.message);
                })
                .then(done, done);
        });
        it("guests can operate on their own images", function (done) {
            var session = testImageUtils.createUnregisteredUserSession("qwertyuiop");
            var testImages = testImageUtils.createTestImages({
                unregisteredSessionID: "qwertyuiop"
            }, 5);
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.ok(image);
                })
                .catch(function (err) {
                    assert.fail(err.message);
                })
                .then(done, done);
        });
        it("guests cannot operate on other guests' images", function (done) {
            var session = testImageUtils.createUnregisteredUserSession("qwertyuiop");
            var testImages = testImageUtils.createTestImages([
                {
                    unregisteredSessionID: "asdfghjkl"
                },
                {
                    unregisteredSessionID: "qwertyuiop"
                }
            ]);
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.fail("Unregistered user was able to operate on another unregistered user's image, "
                        + "but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on one or more of these images.", err.message);
                })
                .then(done, done);
        });
        it("guests cannot operate on a registered user's images", function (done) {
            var session = testImageUtils.createUnregisteredUserSession("qwertyuiop");
            var testImages = testImageUtils.createTestImages([
                {
                    username: "james"
                },
                {
                    unregisteredSessionID: "qwertyuiop"
                }
            ]);
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.fail("Unregistered user was able to operate on a registered user's image, "
                        + "but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on one or more of these images.", err.message);
                })
                .then(done, done);
        });
        it("registered user's cannot operate on guests' images (guests besides themselves)", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImages = testImageUtils.createTestImages([
                {
                    username: "james"
                },
                {
                    unregisteredSessionID: "qwertyuiop"
                }
            ]);
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.fail("Registered user was able to operate on a unregistered user's image, "
                        + "but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on one or more of these images.", err.message);
                })
                .then(done, done);
        });
        it("registered users can operate on images they uploaded as a guest", function (done) {
            var session = testImageUtils.createRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImages = testImageUtils.createTestImages([
                {
                    username: "james"
                },
                {
                    unregisteredSessionID: "qwertyuiop"
                }
            ]);
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.ok(image);
                })
                .catch(function (err) {
                    assert.fail(err.message);
                })
                .then(done, done);
        });
        it("should throw if session is undefined", function (done) {
            var testImages = testImageUtils.createTestImages({
                username: "james"
            }, 2);
            userActions.authorizeUserMultiImageOperation(undefined, testImages)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if session is null", function (done) {
            var testImages = testImageUtils.createTestImages({
                username: "james"
            }, 2);
            userActions.authorizeUserMultiImageOperation(null, testImages)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if images is undefined", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            userActions.authorizeUserMultiImageOperation(session, undefined)
                .catch(function (err) {
                    assert.equal(err.message, "Error occurred when verifying user operations on images.", err.message);
                })
                .then(done, done);
        });
        it("should throw if images is null", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            userActions.authorizeUserMultiImageOperation(session, null)
                .catch(function (err) {
                    assert.equal(err.message, "Error occurred when verifying user operations on images.", err.message);
                })
                .then(done, done);
        });
        it("should not authorize any operation if session is an empty object", function (done) {
            var session = {};
            var testImages = testImageUtils.createTestImages({
                username: "james"
            }, 5);
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.fail("This should not be allowed to happen.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on one or more of these images.", err.message);
                })
                .then(done, done);
        });
        it("should not authorize any operation if image array is an empty object", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImages = {};
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.fail("This should not be allowed to happen.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "There are no image operations to be authenticated.", err.message);
                })
                .then(done, done);
        });
        it("should not authorize any operation if image array has a length of 0 (no images)", function (done) {
            var session = testImageUtils.createRegisteredUserSession("james");
            var testImages = [];
            userActions.authorizeUserMultiImageOperation(session, testImages)
                .then(function (image) {
                    assert.fail("This should not be allowed to happen.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "There are no image operations to be authenticated.", err.message);
                })
                .then(done, done);
        });
    });
    describe("transferGuestImagesToUser", function () {
        beforeEach(function () {
            databaseOpsStub.findImages = function () {
                assert.fail("Stub function not filled in");
            };
            databaseOpsStub.transferUnregisteredUserImagesToRegisteredUser = function () {
                assert.fail("Stub function not filled in");
            };
        });
        it("images owned by an unregistered user can be transferred to a registered user successfully", function (done) {
            var session = testImageUtils.createRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImages = testImageUtils.createTestImages({
                unregisteredSessionID: "qwertyuiop"
            }, 5);
            var testImageIDs = testImages.map(function (testImage) {
                return testImage.id;
            });

            // Stubbing functions to verify data passed in is correct
            databaseOpsStub.findImages = function (imageIDs, callback) {
                assert.strictEqual(imageIDs.length, 5);
                for (var i = 0; i < imageIDs.length; i++) {
                    assert.strictEqual(imageIDs[i], testImageIDs[i]);
                }
                callback(null, testImages);
            };
            databaseOpsStub.transferUnregisteredUserImagesToRegisteredUser = function (imageIDs, username) {
                assert.strictEqual(imageIDs.length, 5);
                for (var i = 0; i < imageIDs.length; i++) {
                    assert.strictEqual(imageIDs[i], testImageIDs[i]);
                }
                assert.strictEqual(username, "james");
                return new Promise(function (resolve, reject) {
                    resolve({
                        ok: 1
                    });
                });
            };

            userActions.transferGuestImagesToUser(session, testImageIDs)
                .then(function (result) {
                    assert.ok(result);
                    assert.equal(result.message, "Images have been transferred to user james successfully.");
                })
                .catch(function (err) {
                    assert.fail(err.stack);
                })
                .then(done, done);
        });
        it("should not allow images owned by another registered user to transfer to a registered user", function (done) {
            var session = testImageUtils.createRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImages = testImageUtils.createTestImages({
                username: "jake"
            }, 5);
            var testImageIDs = testImages.map(function (testImage) {
                return testImage.id;
            });

            // Stubbing functions to verify data passed in is correct
            databaseOpsStub.findImages = function (imageIDs, callback) {
                assert.strictEqual(imageIDs.length, 5);
                for (var i = 0; i < imageIDs.length; i++) {
                    assert.strictEqual(imageIDs[i], testImageIDs[i]);
                }
                callback(null, testImages);
            };
            databaseOpsStub.transferUnregisteredUserImagesToRegisteredUser = function (imageIDs, username) {
                assert.fail("transferUnregisteredUserImagesToRegisteredUser should not be called");
                return new Promise(function (resolve, reject) {
                    resolve({
                        ok: 1
                    });
                });
            };

            userActions.transferGuestImagesToUser(session, testImageIDs)
                .then(function (image) {
                    assert.fail("This should not be allowed to happen.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on one or more of these images.", err.message);
                })
                .then(done, done);
        });
        it("should not allow images owned by an unregistered user to be transferred to another unregistered user");
        it("image transfer failures should not remove the unregistered session ID link");
        it("should throw if an undefined image is passed in");
        it("should throw if a null image is passed in");
        it("should throw if an undefined user is passed in");
        it("should throw if a null user is passed in");
        it("should not perform an image transfer if the images already belong to the registered user");
    });
    describe("userDeleteImage", function () {

    });
    describe("userDeleteImages", function () {

    });
});