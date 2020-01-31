const chai = require("chai");
const chaiHTTP = require("chai-http");
const auth = require("../../lib/auth");
const databaseOps = require("../../lib/database-ops");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
var assert = require("assert");

chai.use(chaiHTTP);
chai.should();

// TODO shut down mongo mem server and remove --exit hopefully

function performUserLogin() {
    return new Promise((resolve, reject) => {
        var agent = chai.request.agent(server.app);
        agent.post("/login")
            .type("form")
            .send({
                "username": "test-user",
                "password": "test"
            })
            .end((err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(agent);
            });
    });
}

describe("integ - change password", () => {
    var mongod = null;
    var db = null;
    const TEST_USER = "test-user";

    before(async function () {
        mongod = new MongoMemoryServer();
        await mongod.getUri();
        await mongod.getPort();
        await mongod.getDbPath();
        await mongod.getDbName();
        const testDBURL = mongod.getInstanceInfo().uri;
        db = await MongoClient.connect(testDBURL);
        return new Promise((resolve, reject) => {
            databaseOps.startDatabaseClient(function (err) {
                if (err) {
                    console.error(err);
                    return;
                }
                server.setOptions({
                    rootDirName: __dirname
                });
                server.runServer(8080, () => {
                    resolve();
                });
            }, {
                dbURL: testDBURL
            });
        });
    });
    beforeEach((done) => {
        databaseOps.addUser({
            username: TEST_USER,
            password: "test",
            email: "test@test.com"
        }, () => {
            done();
        });
    })
    it("should let user change password", (done) => {
        performUserLogin()
            .then((agent) => {
                const newPassword = "Qwerty123!";
                agent.post("/change_password?type=json")
                    .type("form")
                    .send({
                        "oldPassword": "test",
                        "newPassword": newPassword,
                        "newPasswordConfirm": newPassword
                    })
                    .end((err, res) => {
                        assert.equal(res.statusCode, 200);
                        assert.equal(res.body.message, "Password changed");
                        usersCollection = db.collection("users");
                        usersCollection.find({ username: TEST_USER })
                            .toArray((err, users) => {
                                if (err) {
                                    assert.fail(err);
                                    done();
                                    return;
                                }
                                const user = users[0];
                                assert.ok(bcrypt.compareSync(auth.preHashPassword(newPassword), user.password));
                                done();
                            });
                    });
            })
            .catch((err) => {
                assert.fail(err);
                done();
            });
    });
    it("should prevent user from changing password if they provided the wrong old password", (done) => {
        performUserLogin()
            .then((agent) => {
                agent.post("/change_password?type=json")
                    .type("form")
                    .send({
                        "oldPassword": "dsfsd",
                        "newPassword": "Qwerty123!",
                        "newPasswordConfirm": "Qwerty123!"
                    })
                    .end((err, res) => {
                        assert.equal(res.statusCode, 400);
                        assert.equal(res.body.message, "Could not change password. Old password is not correct.");
                        done();
                    });
            })
            .catch((err) => {
                assert.fail(err);
                done();
            });
    });
    it("should prevent user from changing password if the aren't signed in (ie. are guest)", (done) => {
        var agent = chai.request.agent(server.app);
        agent.post("/change_password?type=json")
            .type("form")
            .send({
                "oldPassword": "dsfsd",
                "newPassword": "Qwerty123!",
                "newPasswordConfirm": "Qwerty123!"
            })
            .end((err, res) => {
                assert.equal(res.statusCode, 404);
                assert.equal(res.body.message, "Cannot perform action. Not signed in.");
                done();
            });
    });
    it("should prevent user from changing password if old password is not provided", (done) => {
        assert.fail("Not implemented");
    });
    it("should prevent user from changing password if new password is not provided", (done) => {
        assert.fail("Not implemented");
    });
    it("should prevent user from changing password if new password confirmation is not provided", (done) => {
        assert.fail("Not implemented");
    });
    it("should prevent user from changing password if new password is not strong enough", (done) => {
        assert.fail("Not implemented");
    });
    afterEach(async function () {
        usersCollection = db.collection("users");
        usersCollection.deleteMany({});
    });
    after(async function() {
        mongod.stop();
    });
});