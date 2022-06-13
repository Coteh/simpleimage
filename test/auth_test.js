const assert = require("assert");
const auth = require("../lib/auth");

const bcrypt = require("bcryptjs");
const errMsgs = require("../lib/error-msgs");
const sinon = require("sinon");

describe("auth", function () {
    beforeEach(() => {
        sinon.restore();
    });
    describe("hashPassword", function () {
        it("should create a hash for given user password", function () {
            let stub = sinon.stub(bcrypt, "hash").callsFake((_, __, callback) => {
                callback(null, "myHashedPassword");
            });
            return auth.hashPassword("myPassword").then((hashedPassword) => {
                assert.strictEqual(stub.callCount, 1);
                assert.strictEqual(hashedPassword, "myHashedPassword");
            });
        });
        it("should not create a hash if password is not a string", function () {
            return new Promise((resolve, reject) => {
                auth.hashPassword(6)
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
    describe("authenticateUser", function () {
        it("should authenticate the user if given password and hashed password from DB match", function () {
            let stub = sinon.stub(bcrypt, "compare").callsFake((_, __, callback) => {
                callback(null, true);
            });
            return new Promise((resolve, reject) => {
                auth.authenticateUser(
                    {
                        password: "myHashedPassword",
                    },
                    "myPassword"
                )
                    .then((result) => {
                        resolve(result);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            }).then((err) => {
                assert.strictEqual(stub.callCount, 1);
            });
        });
        it("should fail to authenticate the user if given password and hashed password from DB do not match", function () {
            let stub = sinon.stub(bcrypt, "compare").callsFake((_, __, callback) => {
                callback(null, false);
            });
            return new Promise((resolve, reject) => {
                auth.authenticateUser(
                    {
                        password: "myHashedPassword",
                    },
                    "myPassword"
                )
                    .then(() => {
                        reject(new Error("This user should not be authenticated"));
                    })
                    .catch((err) => {
                        resolve(err);
                    });
            }).then((err) => {
                assert.strictEqual(stub.callCount, 1);
                assert.strictEqual(err.message, errMsgs.USERPASS_COMBO_NOT_FOUND);
            });
        });
        it("should fail to authenticate the user if the password is not a string", function () {
            return new Promise((resolve, reject) => {
                auth.authenticateUser(
                    {
                        password: "myHashedPassword",
                    },
                    6
                )
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
            return new Promise((resolve, reject) => {
                auth.authenticateUser(
                    {
                        password: "myHashedPassword",
                    },
                    undefined
                )
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
            return new Promise((resolve, reject) => {
                auth.authenticateUser(
                    {
                        password: "myHashedPassword",
                    },
                    null
                )
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
        it("should fail to authenticate the user if user reference is undefined", function () {
            return new Promise((resolve, reject) => {
                auth.authenticateUser(undefined, "myPassword")
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
            return new Promise((resolve, reject) => {
                auth.authenticateUser(null, "myPassword")
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
            return new Promise((resolve, reject) => {
                auth.authenticateUser({}, "myPassword")
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
            return new Promise((resolve, reject) => {
                auth.authenticateUser(
                    {
                        password: 6,
                    },
                    "myPassword"
                )
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
