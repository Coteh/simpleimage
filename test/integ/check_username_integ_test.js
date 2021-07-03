const chai = require("chai");
const chaiHTTP = require("chai-http");
const { stub } = require("sinon");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { assert } = chai;

chai.use(chaiHTTP);

// TODO:#119 shut down mongo mem server and remove --exit hopefully

function getServerAgent() {
    return chai.request.agent(server.app);
}

describe("integ", () => {
    describe("check username", () => {
        var mongod = null;
        var db = null;
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";

        function checkUsername(username) {
            return agent.get("/check_username")
                .query({
                    username,
                });
        }

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
                password: "test",
                email: "test@test.com"
            }, () => {
                agent = getServerAgent();
                done();
            });
        });

        it("should report that a username is taken if it already exists", () => {
            return checkUsername(TEST_USER)
                .then(res => {
                    assert.equal(res.statusCode, 200);
                    const message = res.body.message;
                    assert.isTrue(message.exists);
                });
        });

        it("should report that a username is available if it's free", () => {
            return checkUsername("bob")
                .then(res => {
                    assert.equal(res.statusCode, 200);
                    const message = res.body.message;
                    assert.isFalse(message.exists);
                });
        });

        it("should return an error if database error occurs when processing the request", () => {
            const findUserStub = stub(databaseOps, "findUser").callsArgWith(1, new Error("Error finding user"), null);
            return checkUsername(TEST_USER)
                .then(res => {
                    assert.equal(res.statusCode, 500);
                    assert.equal(res.body.errorID, "errorCheckingUser");
                })
                .finally(err => {
                    findUserStub.restore();
                });
        });

        // TODO test rate limiting of check_username route.
        // I believe this will require updating configuration for express-rate-limit in route.js

        it("should return an error if there was no user supplied to the request", () => {
            return checkUsername(undefined)
                .then(res => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "noUsernameToCheck");
                });
        });

        it("should return an error if number of characters for username is over the limit", () => {
            const oldMaxUsernameLength = process.env.MAX_USERNAME_LENGTH;
            process.env.MAX_USERNAME_LENGTH = 24;
            return checkUsername("qwertyuiopasdfghjklzxcvbnm")
                .then(res => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "usernameTooLong")
                })
                .finally(() => process.env.MAX_USERNAME_LENGTH = oldMaxUsernameLength);
        });

        it("should return an error if unknown username verification error occurred", () => {
            const usernameCheckStub = stub(usernameUtil, "verifyUsername").returns({
                valid: false,
                error: "",
            });
            return checkUsername(TEST_USER)
                .then(res => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "usernameUnknownError");
                })
                .finally(() => {
                    usernameCheckStub.restore();
                });
        });

        it("should be safe against MongoDB attack", () => {
            return agent.get("/check_username")
                .query({
                    "username[$gt]": "",
                })
                .then(res => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "invalidUsernameToCheck");
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
