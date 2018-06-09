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

describe("user actions", function() {
    describe("compareUserImageAuthorization", function () {
        it("should return true if username on image is equal to username on session", function () {
            var session = getRegisteredUserSession("james");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: "james"
            };
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), true);
        });
        it("should return false if username on image is not equal to username on session", function () {
            var session = getRegisteredUserSession("james");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: "dude"
            };
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return true if unregistered session ID on image is equal to unregistered session ID on session", function () {
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "qwertyuiop"
            };
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), true);
        });
        it("should return false if unregistered session ID on image is not equal to unregistered session ID on session", function () {
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "asdfghjkl"
            };
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return false if a unregistered user session is used to verify operation on an image uploaded by a registered user", function () {
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: "dude"
            };
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return false if a registered user session is used to verify operation on an image uploaded anonymously", function () {
            var session = getRegisteredUserSession("james");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "qwertyuiop"
            };
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), false);
        });
        it("should return true if a registered user session with unregistered session ID is used to verify operation "
            + "on an image uploaded anonymously with same unregistered session ID", function () {
                var session = getRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "qwertyuiop"
            };
            assert.equal(userActions.compareUserImageAuthorization(session, testImage), true);
        });
        it("should throw if session is undefined", function () {
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: "james"
            };
            assert.throws(function() {
                userActions.compareUserImageAuthorization(undefined, testImage);
            }, function(err) {
                return (err instanceof Error && err.message === "Session is missing")
            });
        });
        it("should throw if session is null", function () {
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: "james"
            };
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
    });
    describe("authorizeUserImageOperation", function() {
        it("users can operate on their own image", function (done) {
            var session = getRegisteredUserSession("james");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: "james"
            };
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
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: "jake"
            };
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("User was able to operate on another user's image, but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.");
                })
                .then(done, done);
        });
        it("guests can operate on their own image", function (done) {
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "qwertyuiop"
            };
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
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "asdfghjkl"
            };
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("Guest was able to operate on another guest's image, but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.");
                })
                .then(done, done);
        });
        it("guests cannot operate on a registered user's image", function (done) {
            var session = getUnregisteredUserSession("qwertyuiop");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: "james"
            };
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("Guest was able to operate on a registered user's image, but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.");
                })
                .then(done, done);
        });
        it("registered users cannot operate on guests' image (guests besides themselves)", function (done) {
            var session = getRegisteredUserSession("james");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "qwertyuiop"
            };
            userActions.authorizeUserImageOperation(session, testImage)
                .then(function (image) {
                    assert.fail("Registered user was able to operate on a guest's image (a guest besides themselves), "
                        + "but they shouldn't be able to in this case.");
                })
                .catch(function (err) {
                    assert.equal(err.message, "You are not authorized to perform operations on this image.");
                })
                .then(done, done);
        });
        it("registered users can operate on image they uploaded as a guest", function (done) {
            var session = getRegisteredUserSessionWithUnregisteredSession("james", "qwertyuiop");
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "qwertyuiop"
            };
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
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "qwertyuiop"
            };
            userActions.authorizeUserImageOperation(undefined, testImage)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing");
                })
                .then(done, done);
        });
        it("should throw if session is null", function (done) {
            var testImage = {
                _id: new ObjectID("".toString().padStart(24, "a")),
                encoding: "7bit",
                uploadeddate: new Date(0),
                data: new Buffer(0),
                mimetype: "image/png",
                id: "abcdef",
                username: null,
                unregisteredSessionID: "qwertyuiop"
            };
            userActions.authorizeUserImageOperation(null, testImage)
                .catch(function (err) {
                    assert.equal(err.message, "Session is missing");
                })
                .then(done, done);
        });
        it("should throw if image is undefined", function (done) {
            var session = getRegisteredUserSession("james");
            userActions.authorizeUserImageOperation(session, undefined)
                .catch(function (err) {
                    assert.equal(err.message, "Image is missing");
                })
                .then(done, done);
        });
        it("should throw if image is null", function (done) {
            var session = getRegisteredUserSession("james");
            userActions.authorizeUserImageOperation(session, null)
                .catch(function (err) {
                    assert.equal(err.message, "Image is missing");
                })
                .then(done, done);
        });
    });
    describe("authorizeUserMultiImageOperation", function () {
        it("users can operate on their own images");
        it("users cannot operate on other users' images");
        it("guests can operate on their own images");
        it("guests cannot operate on other guests' images");
        it("guests cannot operate on a registered user's images");
        it("registered user's cannot operate on guests' images (guests besides themselves)");
        it("registered users can operate on images they uploaded as a guest");
        it("should throw if session is undefined");
        it("should throw if session is null");
        it("should throw if image is undefined");
        it("should throw if image is null");
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