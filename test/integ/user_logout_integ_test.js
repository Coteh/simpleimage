const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { assert } = require("chai");
const { getServerAgent, assertUserLogin } = require("./integ_test_utils");

// TODO:#119 shut down mongo mem server and remove --exit hopefully

const performUserLogout = async (agent, referrer) => {
    const logout = agent.post("/logout")
    if (referrer) {
        logout.set("Referer", referrer);
    }
    return logout;
};

const performUserCheck = async (agent) => agent.get("/user");

describe("integ", () => {
    describe("user logout", () => {
        var mongod = null;
        var db = null;
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "test-password";

        it("should be able to logout user successfully", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return performUserCheck(agent);
                })
                .then((res) => {
                    assert.equal(res.status, 200);
                })
                .then(() => {
                    return performUserLogout(agent);
                })
                .then((res) => {
                    assert.equal(res.status, 200);
                })
                .then(() => {
                    return performUserCheck(agent);
                })
                .then((res) => {
                    assert.equal(res.status, 400);
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
