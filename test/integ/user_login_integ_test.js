const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { assert } = require("chai");
const { stub } = require("sinon");
const {
    getServerAgent,
    addUser,
    MongoMemoryTestClient,
    assertUserLoggedIn,
    assertUserNotLoggedIn,
} = require("./integ_test_utils");

// TODO:#119 shut down mongo mem server and remove --exit hopefully

const performUserLogin = (agent, username, password) => {
    return agent.post("/login").type("form").send({
        username,
        password,
    });
};

describe("integ", () => {
    describe("user login", () => {
        let mongoTestClient = new MongoMemoryTestClient();
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "test-password";

        it("should be able to login user successfully", () => {
            return assertUserNotLoggedIn(agent)
                .then(() => {
                    return performUserLogin(agent, TEST_USER, TEST_PASSWORD);
                })
                .then((res) => {
                    assert.equal(res.status, 200);
                    assert.equal(res.body.username, TEST_USER);
                    return assertUserLoggedIn(agent);
                });
        });

        it("should not be able to login user if username is incorrect", () => {
            return assertUserNotLoggedIn(agent)
                .then(() => {
                    return addUser("some-user", "some-password", "incorrect-user@test.com");
                })
                .then(() => {
                    return performUserLogin(agent, "wrong-user", "some-password");
                })
                .then((res) => {
                    assert.equal(res.status, 401);
                    assert.equal(res.body.errorID, "userPassComboNotFound");
                    return assertUserNotLoggedIn(agent);
                });
        });

        it("should not be able to login user if password is incorrect", () => {
            return assertUserNotLoggedIn(agent)
                .then(() => {
                    return addUser("some-user", "some-password", "incorrect-user@test.com");
                })
                .then(() => {
                    return performUserLogin(agent, "some-user", "wrong-password");
                })
                .then((res) => {
                    assert.equal(res.status, 401);
                    assert.equal(res.body.errorID, "userPassComboNotFound");
                    return assertUserNotLoggedIn(agent);
                });
        });

        it("should not be able to login user if it's nonexistent", () => {
            return assertUserNotLoggedIn(agent)
                .then(() => {
                    return performUserLogin(agent, "nonexistent-user", "password");
                })
                .then((res) => {
                    assert.equal(res.status, 401);
                    assert.equal(res.body.errorID, "userPassComboNotFound");
                    return assertUserNotLoggedIn(agent);
                });
        });

        it("should not be able to login user if username not provided", () => {
            return assertUserNotLoggedIn(agent)
                .then(() => {
                    return performUserLogin(agent, undefined, TEST_PASSWORD);
                })
                .then((res) => {
                    assert.equal(res.status, 422);
                    return assertUserNotLoggedIn(agent);
                });
        });

        it("should not be able to login user if password not provided", () => {
            return assertUserNotLoggedIn(agent)
                .then(() => {
                    return performUserLogin(agent, TEST_USER, undefined);
                })
                .then((res) => {
                    assert.equal(res.status, 422);
                    return assertUserNotLoggedIn(agent);
                });
        });

        it("should fail if database error occurs during login", () => {
            // Stub databaseOps.loginUser to call first argument with an error
            const loginUserStub = stub(databaseOps, "loginUser").callsArgWith(
                1,
                new Error("Database error")
            );
            return assertUserNotLoggedIn(agent)
                .then(() => {
                    return performUserLogin(agent, TEST_USER, TEST_PASSWORD);
                })
                .then((res) => {
                    assert.equal(res.status, 500);
                    assert.equal(res.body.errorID, "loginUserDatabaseError");
                    assert.equal(loginUserStub.callCount, 1);
                    return assertUserNotLoggedIn(agent);
                })
                .finally(() => {
                    loginUserStub.restore();
                });
        });

        before(() => {
            return mongoTestClient.initConnection();
        });

        beforeEach((done) => {
            databaseOps.addUser(
                {
                    username: TEST_USER,
                    password: TEST_PASSWORD,
                    email: "test@test.com",
                },
                () => {
                    agent = getServerAgent();
                    done();
                }
            );
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
