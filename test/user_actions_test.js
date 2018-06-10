const assert = require("assert");
const userActions = require("../lib/user-actions");
const ObjectID = require("mongodb").ObjectID;

var getRegisteredUserSession = function (username = "testuser") {
    return {
        user: {
            username,
            email: username + "@email.com"
        }
    };
};

var getUnregisteredUserSession = function (unregisteredSessionID = "zxcvbnm") {
    return {
        unregisteredSessionID
    };
};

var getRegisteredUserSessionWithUnregisteredSession = function(username, unregisteredSessionID) {
    return Object.assign(getUnregisteredUserSession(unregisteredSessionID), getRegisteredUserSession(username));
};

var getTestImage = function(options) {
    if (!options) {
        options = {};
    }
    return {
        _id: new ObjectID((options.index ? options.index : 0).toString().padStart(24, "0")),
        encoding: "7bit",
        uploadeddate: new Date(0),
        data: new Buffer(0),
        mimetype: "image/png",
        id: options.id || "abcdef",
        username: options.username,
        unregisteredSessionID: options.unregisteredSessionID
    };
};

var getTestImages = function(optionsArr, length) {
    if (!optionsArr) {
        return undefined;
    }
    if (typeof optionsArr === "number") {
        var length = optionsArr;
        optionsArr = new Array(length);
        for (var i = 0; i < length; i++) {
            optionsArr[i] = {};
        }
    } else if (optionsArr instanceof Array) { 
        if (optionsArr.length === 0) {
            return [];
        }
    } else {
        if (!length) {
            return undefined;
        }
        var options = optionsArr;
        optionsArr = new Array(length);
        for (var i = 0; i < length; i++) {
            optionsArr[i] = options;
        }
    }
    return optionsArr.map(function (options, index) {
        return getTestImage(Object.assign({
            index,
            id: index.toString().padStart(6, "0")
        }, options));
    });
};

describe("user actions", function() {
    describe("compareUserImageAuthorization", function () {
        it("should return true if username on image is equal to username on session", function () {
            var session = getRegisteredUserSession("james");
            var testImage = getTestImage({
                username: "james"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), true);
        });
        it("should return false if username on image is not equal to username on session", function () {
            var session = getRegisteredUserSession("james");
            var testImage = getTestImage({
                username: "dude"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return true if unregistered session ID on image is equal to unregistered session ID on session", function () {
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = getTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), true);
        });
        it("should return false if unregistered session ID on image is not equal to unregistered session ID on session", function () {
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = getTestImage({
                unregisteredSessionID: "asdfghjkl"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return false if a unregistered user session is used to verify operation on an image uploaded by a registered user", function () {
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = getTestImage({
                username: "dude"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return false if a registered user session is used to verify operation on an image uploaded anonymously", function () {
            var session = getRegisteredUserSession("james");
            var testImage = getTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return true if a registered user session with unregistered session ID is used to verify operation "
            + "on an image uploaded anonymously with same unregistered session ID", function () {
                var session = getRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImage = getTestImage({
                unregisteredSessionID: "qwertyuiop"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), true);
        });
        it("should throw if session is undefined", function () {
            var testImage = getTestImage({
                username: "james"
            });
            assert.throws(function() {
                userActions.compareUserImageAuthorization(undefined, testImage);
            }, function(err) {
                return (err instanceof Error && err.message === "Session is missing")
            });
        });
        it("should throw if session is null", function () {
            var testImage = getTestImage({
                username: "james"
            });
            assert.throws(function() {
                userActions.compareUserImageAuthorization(null, testImage);
            }, function(err) {
                return (err instanceof Error && err.message === "Session is missing")
            });
        });
        it("should throw if image is undefined", function () {
            var session = getRegisteredUserSession();
            assert.throws(function() {
                userActions.compareUserImageAuthorization(session, undefined);
            }, function(err) {
                return (err instanceof Error && err.message === "Image is missing")
            });
        });
        it("should throw if image is null", function () {
            var session = getRegisteredUserSession();
            assert.throws(function() {
                userActions.compareUserImageAuthorization(session, null);
            }, function(err) {
                return (err instanceof Error && err.message === "Image is missing")
            });
        });
        it("should return false if session is an empty object", function () {
            var session = {};
            var testImage = getTestImage({
                username: "james"
            });
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return false if image is an empty object", function () {
            var session = getRegisteredUserSession("james");
            var testImage = {};
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
    });
    describe("authorizeUserImageOperation", function() {
        it("users can operate on their own image", function (done) {
            var session = getRegisteredUserSession("james");
            var testImage = getTestImage({
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
            var session = getRegisteredUserSession("james");
            var testImage = getTestImage({
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
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = getTestImage({
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
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = getTestImage({
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
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = getTestImage({
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
            var session = getRegisteredUserSession("james");
            var testImage = getTestImage({
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
            var session = getRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImage = getTestImage({
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
            var testImage = getTestImage({
                username: "james"
            });
            userActions.authorizeUserImageOperation(undefined, testImage)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if session is null", function (done) {
            var testImage = getTestImage({
                username: "james"
            });
            userActions.authorizeUserImageOperation(null, testImage)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if image is undefined", function (done) {
            var session = getRegisteredUserSession("james");
            userActions.authorizeUserImageOperation(session, undefined)
                .catch(function (err) {
                    assert.equal(err.message, "Image is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if image is null", function (done) {
            var session = getRegisteredUserSession("james");
            userActions.authorizeUserImageOperation(session, null)
                .catch(function (err) {
                    assert.equal(err.message, "Image is missing", err.message);
                })
                .then(done, done);
        });
        it("should not authorize any operation if session provided is an empty object", function (done) {
            var session = {};
            var testImage = getTestImage({
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
            var session = getRegisteredUserSession("james");
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
            var session = getRegisteredUserSession("james");
            var testImages = getTestImages({
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
            var session = getRegisteredUserSession("james");
            var testImages = getTestImages([
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
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImages = getTestImages({
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
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImages = getTestImages([
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
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImages = getTestImages([
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
            var session = getRegisteredUserSession("james");
            var testImages = getTestImages([
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
            var session = getRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImages = getTestImages([
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
            var testImages = getTestImages({
                username: "james"
            }, 2);
            userActions.authorizeUserMultiImageOperation(undefined, testImages)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if session is null", function (done) {
            var testImages = getTestImages({
                username: "james"
            }, 2);
            userActions.authorizeUserMultiImageOperation(null, testImages)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing", err.message);
                })
                .then(done, done);
        });
        it("should throw if images is undefined", function (done) {
            var session = getRegisteredUserSession("james");
            userActions.authorizeUserMultiImageOperation(session, undefined)
                .catch(function (err) {
                    assert.equal(err.message, "Error occurred when verifying user operations on images.", err.message);
                })
                .then(done, done);
        });
        it("should throw if images is null", function (done) {
            var session = getRegisteredUserSession("james");
            userActions.authorizeUserMultiImageOperation(session, null)
                .catch(function (err) {
                    assert.equal(err.message, "Error occurred when verifying user operations on images.", err.message);
                })
                .then(done, done);
        });
        it("should not authorize any operation if session is an empty object", function (done) {
            var session = {};
            var testImages = getTestImages({
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
            var session = getRegisteredUserSession("james");
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
            var session = getRegisteredUserSession("james");
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
    describe("transferGuestImageToUser", function () {
        it("an image owned by an unregistered user can be transferred to a registered user successfully");
        it("an image transferred from unregistered user to a registered user shall have its unregistered session ID removed");
        it("should not allow an image owned by another registered user to transfer to a registered user");
        it("should not allow an image owned by an unregistered user to be transferred to another unregistered user");
        it("image transfer failures should not remove the unregistered session ID link");
        it("should throw if an undefined image is passed in");
        it("should throw if a null image is passed in");
        it("should throw if an undefined user is passed in");
        it("should throw if a null user is passed in");
    });
});