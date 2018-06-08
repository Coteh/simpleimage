const assert = require("assert");
const userActions = require("../lib/user-actions");
const ObjectID = require("mongodb").ObjectID;

var getRegisteredUserSession = function() {
    return {
        user: {
            username: "james",
            email: "james@james.com"
        }
    };
};

var getUnregisteredUserSession = function() {
    return {
        unregisteredSessionID: "qwertyuiop"
    };
};

var getRegisteredUserSessionWithUnregisteredSession = function() {
    return Object.assign(getUnregisteredUserSession(), getRegisteredUserSession());
};

describe("user actions", function() {
    describe("compareUserImageAuthorization", function () {
        it("should return true if username on image is equal to username on session", function () {
            var session = getRegisteredUserSession();
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
            var session = getRegisteredUserSession();
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
            var session = getUnregisteredUserSession();
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
            var session = getUnregisteredUserSession();
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
            var session = getUnregisteredUserSession();
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
            var session = getRegisteredUserSession();
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
            var session = getRegisteredUserSessionWithUnregisteredSession();
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
            var session = getRegisteredUserSession();
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
            var session = getRegisteredUserSession();
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
        it("users can operate on their own image", function(done) {
            var session = getRegisteredUserSession();
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
                    done();
                })
                .catch(function (err) {
                    assert.fail(err.message);
                });
        });
        it("users cannot operate on other users' image", function() {
            assert.fail("Not implemented");
        });
        it("guests can operate on their own image", function() {
            assert.fail("Not implemented");
        });
        it("guests cannot operate on other guests' image", function() {
            assert.fail("Not implemented");
        });
        it("guests cannot operate on a registered user's image", function() {
            assert.fail("Not implemented");
        });
        it("registered user's cannot operate on guests' image (guests besides themselves)", function() {
            assert.fail("Not implemented");
        });
        it("registered users can operate on image they uploaded as a guest", function() {
            assert.fail("Not implemented");
        });
    });
    describe("authorizeUserMultiImageOperation", function () {
        it("users can operate on their own images", function () {
            assert.fail("Not implemented");
        });
        it("users cannot operate on other users' images", function () {
            assert.fail("Not implemented");
        });
        it("guests can operate on their own images", function () {
            assert.fail("Not implemented");
        });
        it("guests cannot operate on other guests' images", function () {
            assert.fail("Not implemented");
        });
        it("guests cannot operate on a registered user's images", function () {
            assert.fail("Not implemented");
        });
        it("registered user's cannot operate on guests' images (guests besides themselves)", function () {
            assert.fail("Not implemented");
        });
        it("registered users can operate on images they uploaded as a guest", function () {
            assert.fail("Not implemented");
        });
    });
});