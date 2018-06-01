const assert = require("assert");

describe("user actions", function() {
    describe("compareUserImageAuthorization", function () {
        it("should return true if username on image is equal to username on session", function () {
            assert.fail("Not implemented");
        });
        it("should return false if username on image is not equal to username on session", function () {
            assert.fail("Not implemented");
        });
        it("should return true if unregistered session ID on image is equal to unregistered session ID on session", function () {
            assert.fail("Not implemented");
        });
        it("should return false if unregistered session ID on image is not equal to unregistered session ID on session", function () {
            assert.fail("Not implemented");
        });
        it("should return false if a unregistered user session is used to verify operation on an image uploaded by a registered user", function () {
            assert.fail("Not implemented");
        });
        it("should return false if a registered user session is used to verify operation on an image uploaded anonymously", function () {
            assert.fail("Not implemented");
        });
        it("should return true if a registered user session with unregistered session ID is used to verify operation "
            + "on an image uploaded anonymously with same unregistered session ID", function () {
            assert.fail("Not implemented");
        });
    });
    describe("authorizeUserImageOperation", function() {
        it("users can operate on their own image", function() {
            assert.fail("Not implemented");
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