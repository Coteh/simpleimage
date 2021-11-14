const chai = require("chai");
const chaiHTTP = require("chai-http");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { assert } = chai;
const { getServerAgent, assertUserLogin } = require("./integ_test_utils");

chai.use(chaiHTTP);

// TODO:#119 shut down mongo mem server and remove --exit hopefully

describe("integ", () => {
    describe("check user login", () => {
        var mongod = null;
        var db = null;
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "test-password";

        function checkUserLogin() {
            return new Promise((resolve, reject) => {
                agent.get("/user")
                .send()
                .then((res) => {
                    resolve(res);
                    agent.close();
                })
                .catch((err) => {
                    reject(err);
                    agent.close();
                });
            });
        }

        it("should pass if user is logged in", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    return checkUserLogin();
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                });
        });

        it("should fail if user is not logged in", () => {
            return checkUserLogin()
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "notSignedIn");
                });
        });

        it("should fail if logged in user does not exist in database", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    usersCollection = db.collection("users");
                    await usersCollection.deleteOne({ username: TEST_USER });
                    return checkUserLogin();
                }).then((res) => {
                    assert.equal(res.statusCode, 404);
                    assert.equal(res.body.errorID, "sessionUserNotFound");
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
