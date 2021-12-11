const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { assert } = require("chai");
const { getServerAgent, assertUserLogin, MongoMemoryTestClient, assertUserLoggedIn, assertUserNotLoggedIn } = require("./integ_test_utils");

// TODO:#119 shut down mongo mem server and remove --exit hopefully

const performUserLogout = async (agent, referrer) => {
    const logout = agent.post("/logout")
    if (referrer) {
        logout.set("Referer", referrer);
    }
    return logout;
};

describe("integ", () => {
    describe("user logout", () => {
        let mongoTestClient = new MongoMemoryTestClient();
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "test-password";

        it("should be able to logout user successfully", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return assertUserLoggedIn(agent);
                })
                .then(() => {
                    return performUserLogout(agent);
                })
                .then((res) => {
                    assert.equal(res.status, 200);
                })
                .then(() => {
                    return assertUserNotLoggedIn(agent);
                });
        });

        it("should redirect to current page if user logged out in a non-settings page", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return performUserLogout(agent, "/images/123456");
                })
                .then((res) => {
                    assert.equal(res.redirects[0], `http://127.0.0.1:${agent.app.address().port}/images/123456`);
                });
        });

        it("should redirect to homepage if user logged out in a settings page", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return performUserLogout(agent, "/settings");
                })
                .then((res) => {
                    assert.equal(res.redirects[0], `http://127.0.0.1:${agent.app.address().port}/`);
                });
        });

        it("should redirect to homepage if user logged out with undefined Referrer header", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return performUserLogout(agent);
                })
                .then((res) => {
                    assert.equal(res.redirects[0], `http://127.0.0.1:${agent.app.address().port}/`);
                });
        });

        it("should still succeed if user was not logged in", () => {
            return performUserLogout(agent)
                .then((res) => {
                    assert.equal(res.status, 200);
                });
        });

        it("should still succeed if user does not exist", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                then(() => {
                    usersCollection = mongoTestClient.db.collection("users");
                    return usersCollection.deleteOne({ username: TEST_USER });
                })
                .then((res) => {
                    assert.strictEqual(res.deletedCount, 1);
                    return performUserLogout(agent, "/");
                })
                .then((res) => {
                    assert.equal(res.status, 200);
                });
        });

        before(() => {
            return mongoTestClient.initConnection();
        });

        beforeEach((done) => {
            databaseOps.addUser({
                username: TEST_USER,
                password: TEST_PASSWORD,
                email: "test@test.com"
            }, () => {
                agent = getServerAgent();
                done();
            });
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
