const assert = require("assert");

describe("user actions", function() {
    describe("compareUserImageAuthorization", function() {
        it("should return true if username on image is equal to username on session "
            + "(users can operate on their own images)", function() {
            assert.fail("Not implemented");
        });
        it("should return false if username on image is not equal to username on session "
        + "(users cannot operate on other users' images)", function() {
            assert.fail("Not implemented");
        });
        it("should return true if unregistered session ID on image is equal to unregistered session ID on session "
        + "(guests can operate on their own images)", function() {
            assert.fail("Not implemented");
        });
        it("should return false if unregistered session ID on image is not equal to unregistered session ID on session "
        + "(guests cannot operate on other guests' images)", function() {
            assert.fail("Not implemented");
        });
        it("should return false if a unregistered user session is used to verify operation on an image uploaded by a registered user "
        + "(guests cannot operate on a registered user's images)", function() {
            assert.fail("Not implemented");
        });
        it("should return false if a registered user session is used to verify operation on an image uploaded anonymously "
        + "(registered user's cannot operate on guests' images)", function() {
            assert.fail("Not implemented");
        });
        it("should return true if a registered user session with unregistered session ID is used to verify operation on an image uploaded anonymously with same unregistered session ID "
        + "(as an exception to previous test, registered users can operate on images they uploaded when they were a guest)", function() {
            assert.fail("Not implemented");
        });
    });
});