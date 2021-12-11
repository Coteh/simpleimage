const databaseOps = require("../../lib/database-ops");
const actionHistory = require("../../lib/action-history");
const usernameUtil = require("../../lib/util/username");
const { assert } = require("chai");
const { stub } = require("sinon");
const { getServerAgent, addUser, assertUserDoesNotExist, assertUserExists, MongoMemoryTestClient } = require("./integ_test_utils");

// TODO:#119 shut down mongo mem server and remove --exit hopefully

const registerUser = async (agent, username, password, passwordConfirm, email) => {
    return await agent.post("/register")
        .send({
            username,
            password,
            passwordConfirm,
            email,
        });
    };

describe("integ", () => {
    describe("user register", () => {
        let mongoTestClient = new MongoMemoryTestClient();
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "Testing123!@#";
        const TEST_EMAIL = "test@test.com";

        it("should be able to register user successfully", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 200);
                    assert.equal(res.body.status, "success");
                    return assertUserExists(TEST_USER);
                });
        });

        it("should not be able to register user if password confirmation is incorrect", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, "wrong-password", TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordMismatch");
                    return assertUserDoesNotExist(TEST_USER);
                });
        });

        it("should not be able to register user if username is taken", () => {
            const assertUserEmail = (email) => {
                return new Promise((resolve) => {
                    databaseOps.findUser(TEST_USER, (err, result) => {
                        assert.isTrue(!err && result.length > 0);
                        assert.strictEqual(result[0].username, TEST_USER);
                        assert.strictEqual(result[0].email, email);
                        resolve();
                    });
                });
            }
            return addUser(TEST_USER, TEST_PASSWORD, TEST_EMAIL)
                .then(() => {
                    return assertUserEmail(TEST_EMAIL);
                })
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, "not.test.user@example.com");
                })
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "usernameTaken");
                    return assertUserEmail(TEST_EMAIL);
                });
        });

        it("should not be able to register user if username is empty", () => {
            return assertUserDoesNotExist("")
                .then(() => {
                    return registerUser(agent, "", TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "usernameEmpty");
                    return assertUserDoesNotExist("");
                });
        });

        it("should not be able to register user if password is empty", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, "", TEST_PASSWORD, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordEmpty");
                    return assertUserDoesNotExist(TEST_USER);
                });
        });

        it("should not be able to register user if password confirmation is empty", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, "", TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordConfirmEmpty");
                    return assertUserDoesNotExist(TEST_USER);
                });
        });

        it("should not be able to register user if email is empty", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, "");
                })
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "emailEmpty");
                    return assertUserDoesNotExist(TEST_USER);
                });
        });

        it("should not be able to register user if email is invalid", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, "invalidemail");
                })
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "emailInvalid");
                    return assertUserDoesNotExist(TEST_USER);
                });
        });

        it("should not be able to register user if username is too long", () => {
            const longUsername = "reallyreallyreallyreallyreallyreallyreallyreallyreallyreallylongusername";
            return assertUserDoesNotExist(longUsername)
                .then(() => {
                    return registerUser(agent, longUsername, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "usernameTooLong");
                    return assertUserDoesNotExist(longUsername);
                });
        });

        it("should not be able to register user if password does not meet requirements", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, "badpassword", "badpassword", TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "weakPassword");
                    return assertUserDoesNotExist(TEST_USER);
                });
        });

        it("should not be able to register user if username is undefined", () => {
            return assertUserDoesNotExist(undefined)
                .then(() => {
                    return registerUser(agent, undefined, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "usernameEmpty");
                    return assertUserDoesNotExist(undefined);
                });
        });

        it("should not be able to register user if password is undefined", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, undefined, TEST_PASSWORD, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordEmpty");
                    return assertUserDoesNotExist(TEST_USER);
                });
        });

        it("should not be able to register user if password confirm is undefined", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, undefined, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordConfirmEmpty");
                    return assertUserDoesNotExist(TEST_USER);
                });
        });

        it("should not be able to register user if email is undefined", () => {
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, undefined);
                })
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "emailEmpty");
                    return assertUserDoesNotExist(TEST_USER);
                });
        });

        it("should fail if database cannot add user", () => {
            const addUserStub = stub(databaseOps, "addUser").callsArgWith(1, new Error("Database error"));
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 500);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "databaseError");
                    assert.isTrue(addUserStub.calledOnce);
                    return assertUserDoesNotExist(TEST_USER);
                })
                .finally(() => {
                    addUserStub.restore();
                });
        });

        it("should still succeed if writing to action history fails", () => {
            const actionHistoryStub = stub(actionHistory, "writeActionHistory").callsArgWith(1, new Error("Could not write action history entry"), null);
            return assertUserDoesNotExist(TEST_USER)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 200);
                    assert.equal(res.body.status, "success");
                    assert.isTrue(actionHistoryStub.calledOnce);
                    return assertUserExists(TEST_USER);
                })
                .finally(() => {
                    actionHistoryStub.restore();
                })
        });

        before(() => {
            return mongoTestClient.initConnection();
        });

        beforeEach(() => {
            agent = getServerAgent();
        });

        afterEach(() => {
            usersCollection = mongoTestClient.db.collection("users");
            usersCollection.deleteMany({});
            agent.close();
        });

        after(() => {
            return mongoTestClient.deinitConnection();
        });
    });
});
