const chai = require("chai");
const chaiHTTP = require("chai-http");
const sinon = require("sinon");
const auth = require("../../lib/auth");
const databaseOps = require("../../lib/database-ops");
const actionHistory = require("../../lib/action-history");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
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
                .then(async (res) => {
                    assert.equal(res.statusCode, 200);
                    console.log("username exists body", res.body);
                    assert.ok(res.body.exists);
                });
        });

        it("should report that a username is available if it's free", () => {
            return checkUsername("bob")
                .then(async (res) => {
                    assert.equal(res.statusCode, 200);
                    assert.notOk(res.body.exists);
                });
        });

        it("should return an error if number of requests made to the endpoint exceeds the rate limit", () => {
            return Promise.allSettled(new Array(10).fill(checkUsername(TEST_USER)))
                .then(results => {
                    let exceededLimit = false;
                    results.forEach(res => {
                        assert.equal(res.status, "fulfilled");
                        console.log("the body", res.value.body);
                        if (res.value.statusCode === 429) {
                            assert.equal(res.value.body.errorID, "tooManyRequests");
                        } else {
                            assert.equal(res.value.statusCode, 200);
                        }
                    });
                    console.log("rapid request result", res);
                    throw new Error("Not implemented");
                });
        });

        it("should return an error if there was no user supplied to the request", () => {
            return checkUsername(undefined)
                .then(res => {
                    console.log("no usr body", res.body);
                    assert.equal(res.statusCode, 400);
                    assert.isUndefined(res.body.exists);
                    assert.equal(res.body.errorID, "noUsernameToCheck");
                    throw new Error("Not implemented");
                });
        });

        afterEach(async function () {
            usersCollection = db.collection("users");
            usersCollection.deleteMany({});
            agent.close();
        });
        after(async function() {
            mongod.stop();
            databaseOps.closeDatabaseClient();
        });
    });
});
