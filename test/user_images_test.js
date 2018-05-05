const assert = require("assert");

describe("user images", function() {
    describe("registered users", function() {
        it("should return a list of images given a specified user from database", function() {
            assert.fail("Not implemented");
        });

        it("should return an appropriate error if username is invalid", function() {
            assert.fail("Not implemented");
        });

        it("should return no results if supplied user does not have any images uploaded", function() {
            assert.fail("Not implemented");
        });
    });

    describe("unregistered users", function() {
        it("should return a list of images uploaded by user given a session ID and IP address", function() {
            assert.fail("Not implemented");
        });

        it("should return an appropriate error if invalid session ID and IP address combination provided", function() {
            assert.fail("Not implemented");
        });

        it("should not return any results if session ID and IP address combination has no images associated with the pair", function() {
            assert.fail("Not implemented");
        });
    });
});