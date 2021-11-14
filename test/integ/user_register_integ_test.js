const databaseOps = require("../../lib/database-ops");
const actionHistory = require("../../lib/action-history");
const usernameUtil = require("../../lib/util/username");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { assert } = require("chai");
const { stub } = require("sinon");
const { getServerAgent, addUser } = require("./integ_test_utils");

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
        var mongod = null;
        var db = null;
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "Testing123!@#";
        const TEST_EMAIL = "test@test.com";

        it("should be able to register user successfully", () => {
            return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 200);
                    assert.equal(res.body.status, "success");
                }
            );
        });

        it("should not be able to register user if password confirmation is incorrect", () => {
            return registerUser(agent, TEST_USER, TEST_PASSWORD, "wrong-password", TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordMismatch");
                }
            );
        });

        it("should not be able to register user if username is taken", () => {
            return addUser(TEST_USER, TEST_PASSWORD, TEST_EMAIL)
                .then(() => {
                    return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL);
                })
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "usernameTaken");
                });
        });

        it("should not be able to register user if username is empty", () => {
            return registerUser(agent, "", TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "usernameEmpty");
                });
        });

        it("should not be able to register user if password is empty", () => {
            return registerUser(agent, TEST_USER, "", TEST_PASSWORD, TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordEmpty");
                });
        });

        it("should not be able to register user if password confirmation is empty", () => {
            return registerUser(agent, TEST_USER, TEST_PASSWORD, "", TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordConfirmEmpty");
                });
        });

        it("should not be able to register user if email is empty", () => {
            return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, "")
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "emailEmpty");
                });
        });

        it("should not be able to register user if email is invalid", () => {
            return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, "invalidemail")
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "emailInvalid");
                });
        });

        it("should not be able to register user if username is too long", () => {
            return registerUser(agent, "reallyreallyreallyreallyreallyreallyreallyreallyreallyreallylongusername", TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "usernameTooLong");
                });
        });

        it("should not be able to register user if password does not meet requirements", () => {
            return registerUser(agent, TEST_USER, "badpassword", "badpassword", TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 400);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "weakPassword");
                });
        });

        it("should not be able to register user if username is undefined", () => {
            return registerUser(agent, undefined, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "usernameEmpty");
                });
        });

        it("should not be able to register user if password is undefined", () => {
            return registerUser(agent, TEST_USER, undefined, TEST_PASSWORD, TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordEmpty");
                });
        });

        it("should not be able to register user if password confirm is undefined", () => {
            return registerUser(agent, TEST_USER, TEST_PASSWORD, undefined, TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "passwordConfirmEmpty");
                });
        });

        it("should not be able to register user if email is undefined", () => {
            return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, undefined)
                .then(res => {
                    assert.equal(res.status, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "emailEmpty");
                });
        });

        it("should fail if database cannot add user", () => {
            const addUserStub = stub(databaseOps, "addUser").callsArgWith(1, new Error("Database error"));
            return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 500);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "databaseError");
                    assert.isTrue(addUserStub.calledOnce);
                })
                .finally(() => {
                    addUserStub.restore();
                });
        });

        it("should still succeed if writing to action history fails", () => {
            actionHistoryStub = stub(actionHistory, "writeActionHistory").callsArgWith(1, new Error("Could not write action history entry"), null);
            return registerUser(agent, TEST_USER, TEST_PASSWORD, TEST_PASSWORD, TEST_EMAIL)
                .then(res => {
                    assert.equal(res.status, 200);
                    assert.equal(res.body.status, "success");
                    assert.isTrue(actionHistoryStub.calledOnce);
                })
                .finally(() => {
                    actionHistoryStub.restore();
                })
        });

        before(async function () {
            mongod = new MongoMemoryServer();
            await mongod.getUri();
            await mongod.getPort();
            await mongod.getDbPath();
            await mongod.getDbName();
            const testDBURL = mongod.getInstanceInfo().uri;
            db = await MongoClient.connect(testDBURL);
            return databaseOps.startDatabaseClient(function (err) {
                if (err) {
                    console.error(err);
                    return;
                }
            }, {
                dbURL: testDBURL
            });
        });

        beforeEach(() => {
            agent = getServerAgent();
        });

        afterEach(() => {
            usersCollection = db.collection("users");
            usersCollection.deleteMany({});
            agent.close();
        });

        after(() => {
            mongod.stop();
            databaseOps.closeDatabaseClient();
        });
    });
});
