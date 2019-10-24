const assert = require("assert");
const auth = require("../lib/auth");

const REGULAR_PASSWORD = "myPassword";
const REGULAR_PASSWORD_HASHED = "$2a$10$LgUwc4WQBxjoAQYM/jxha.7nT2m5yMYd6PHeVn.4VYuu86JCjdPqC";
const BCRYPT_CUTOFF_SAMPLE = "abcdefgabcdefgabcdefgabcdefgabcdefgabcdefgabcdefgabcdefgabcdefgabcdefgabcdefgabcdefg";
const LONG_PASSWORD = BCRYPT_CUTOFF_SAMPLE + "A";
const LONG_PASSWORD_HASHED = "$2a$10$YiuBDJeubPLYin3TknOEbuUXkiUcjPRmKNesaubst8lXSHZ2xDDwK";
const ALT_LONG_PASSWORD = BCRYPT_CUTOFF_SAMPLE + "D";

describe("auth", function () {
    describe("authenticateUser", function() {
        it("should authenticate the user with a given password and matching hash", function() {
            var testPassword = REGULAR_PASSWORD;
            var user = {
                password: REGULAR_PASSWORD_HASHED
            };
            return new Promise((resolve, reject) => {
                auth.authenticateUser(user, testPassword)
                    .then((result) => {
                        resolve(result);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        });
        it("should fail to authenticate the user if the given password cannot compare with the hash", function() {
            var testPassword = "this should not work";
            var user = {
                password: REGULAR_PASSWORD_HASHED
            };
            return new Promise((resolve, reject) => {
                auth.authenticateUser(user, testPassword)
                    .then(() => {
                        reject(new Error("This user should not be authenticated"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, "Could not login user. Username and password combination not found.");
            });
        });
        it("should fail to authenticate the user if the password is greater than 72 characters and the first 72 characters match, but the rest don't", function() {
            var testPassword = ALT_LONG_PASSWORD;
            var user = {
                password: LONG_PASSWORD_HASHED
            };
            return new Promise((resolve, reject) => {
                auth.authenticateUser(user, testPassword)
                    .then(() => {
                        reject(new Error("This user should not be authenticated"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, "Could not login user. Username and password combination not found.");
            });
        });
        it("should authenticate a user with a long password past bcrypt's limitations", function() {
            var testPassword = LONG_PASSWORD;
            var user = {
                password: LONG_PASSWORD_HASHED
            };
            return new Promise((resolve, reject) => {
                auth.authenticateUser(user, testPassword)
                    .then((result) => {
                        resolve(result);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        })
        it("should fail to authenticate the user if the password is not a string", function() {
            assert.fail("Not yet implemented");
        });
        it("should fail to authenticate the user if the password is undefined", function () {
            assert.fail("Not yet implemented");
        });
        it("should fail to authenticate the user if the password is null", function () {
            assert.fail("Not yet implemented");
        });
    });
});
