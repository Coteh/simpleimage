const assert = require("assert");
const auth = require("../lib/auth");

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const errMsgs = require("../lib/error-msgs");

const REGULAR_PASSWORD = "myPassword";
const REGULAR_PASSWORD_HASHED = "$2a$10$LgUwc4WQBxjoAQYM/jxha.7nT2m5yMYd6PHeVn.4VYuu86JCjdPqC";
const BCRYPT_CUTOFF_SAMPLE = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef";
const LONG_PASSWORD = BCRYPT_CUTOFF_SAMPLE + "A";
const LONG_PASSWORD_HASHED = "$2a$10$XRrOYig1EBlIwfmKaIen5uM17YOc0E4yXR/o6rDzcK0gr01pIUhPq";
const ALT_LONG_PASSWORD = BCRYPT_CUTOFF_SAMPLE + "D";

describe("auth", function () {
    describe("hashPassword", function() {
        it("should create an appropriate hash for given user password", function() {
            var testPassword = REGULAR_PASSWORD;
            return new Promise((resolve, reject) => {
                auth.hashPassword(testPassword)
                    .then((hashedPassword) => {
                        resolve(hashedPassword);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            }).then((hashedPassword) => {
                let testPasswordPreHashed = auth.preHashPassword(testPassword);
                assert.ok(bcrypt.compareSync(testPasswordPreHashed, hashedPassword));
            });
        });
        it("should create a hash of a long password (>72 chars) that cannot be matched with a hash of another >72 char password with same first 72 chars", function() {
            var testPassword = LONG_PASSWORD;
            return new Promise((resolve, reject) => {
                auth.hashPassword(testPassword)
                    .then((hashedPassword) => {
                        resolve(hashedPassword);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            }).then((hashedPassword) => {
                let testPasswordPreHashed = auth.preHashPassword(ALT_LONG_PASSWORD);
                assert.equal(bcrypt.compareSync(testPasswordPreHashed, hashedPassword), false);
            });
        });
        it("should not create a hash if password is not a string", function () {
            var testPassword = 6;
            return new Promise((resolve, reject) => {
                auth.hashPassword(testPassword)
                    .then(() => {
                        reject(new Error("Password should not have been hashed"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, auth.ERRORS.CANNOT_HASH_NONSTRING);
            });
        });
        it("should not create a hash if password is undefined", function () {
            return new Promise((resolve, reject) => {
                auth.hashPassword(undefined)
                    .then(() => {
                        reject(new Error("Password should not have been hashed"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, auth.ERRORS.CANNOT_HASH_NONSTRING);
            });
        });
        it("should not create a hash if password is null", function () {
            return new Promise((resolve, reject) => {
                auth.hashPassword(null)
                    .then(() => {
                        reject(new Error("Password should not have been hashed"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, auth.ERRORS.CANNOT_HASH_NONSTRING);
            });
        });
    });
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
                assert.strictEqual(err.message, errMsgs.USERPASS_COMBO_NOT_FOUND);
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
                assert.strictEqual(err.message, errMsgs.USERPASS_COMBO_NOT_FOUND);
            });
        });
        it("should authenticate a user with a long password past bcrypt's limitations (72 chars)", function() {
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
            var testPassword = 6;
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
                assert.strictEqual(err.message, auth.ERRORS.INVALID_PASSWORD_ATTEMPT);
            });
        });
        it("should fail to authenticate the user if the password is undefined", function () {
            var user = {
                password: LONG_PASSWORD_HASHED
            };
            return new Promise((resolve, reject) => {
                auth.authenticateUser(user, undefined)
                    .then(() => {
                        reject(new Error("This user should not be authenticated"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, auth.ERRORS.INVALID_PASSWORD_ATTEMPT);
            });
        });
        it("should fail to authenticate the user if the password is null", function () {
            var user = {
                password: LONG_PASSWORD_HASHED
            };
            return new Promise((resolve, reject) => {
                auth.authenticateUser(user, null)
                    .then(() => {
                        reject(new Error("This user should not be authenticated"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, auth.ERRORS.INVALID_PASSWORD_ATTEMPT);
            });
        });
        it("should fail to authenticate the user if user reference is undefined", function() {
            var testPassword = REGULAR_PASSWORD;
            return new Promise((resolve, reject) => {
                auth.authenticateUser(undefined, testPassword)
                    .then(() => {
                        reject(new Error("This user should not be authenticated"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, auth.ERRORS.INVALID_AUTH_USER);
            });
        });
        it("should fail to authenticate the user if user reference is null", function () {
            var testPassword = REGULAR_PASSWORD;
            return new Promise((resolve, reject) => {
                auth.authenticateUser(null, testPassword)
                    .then(() => {
                        reject(new Error("This user should not be authenticated"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, auth.ERRORS.INVALID_AUTH_USER);
            });
        });
        it("should fail to authenticate the user if user reference does not contain a 'password' field", function () {
            var testPassword = REGULAR_PASSWORD;
            var user = {};
            return new Promise((resolve, reject) => {
                auth.authenticateUser(user, testPassword)
                    .then(() => {
                        reject(new Error("This user should not be authenticated"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(err.message, auth.ERRORS.INVALID_AUTH_USER);
            });
        });
        it("should fail to authenticate the user if user reference's 'password' field is not a string", function () {
            var testPassword = REGULAR_PASSWORD;
            var user = {
                password: 6
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
                assert.strictEqual(err.message, auth.ERRORS.INVALID_AUTH_USER);
            });
        });
    });
});
