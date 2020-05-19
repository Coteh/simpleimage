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

function performAsyncTest(callback) {
    return new Promise(callback);
}

function performUserLogin() {
    return new Promise((resolve, reject) => {
        var agent = chai.request.agent(server.app);
        agent.post("/login")
            .type("form")
            .send({
                "username": "test-user",
                "password": "test"
            })
            .then((res) => {
                resolve(agent);
            })
            .catch((err) => {
                reject(err);
            });
    });
}

describe("integ - change password", () => {
    var mongod = null;
    var db = null;
    const TEST_USER = "test-user";

    function checkPassword(username, password) {
        return new Promise((resolve, reject) => {
            usersCollection = db.collection("users");
            usersCollection.find({ username })
                .toArray((err, users) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const user = users[0];
                    if (bcrypt.compareSync(auth.preHashPassword(password), user.password)) {
                        resolve();
                    } else {
                        reject(new Error("Password not correct"));
                    }
                });
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
    it("should let user change password", () => {
        return performAsyncTest((resolve, reject) => {
            performUserLogin()
                .then(async (agent) => {
                    await checkPassword(TEST_USER, "test");
                    const newPassword = "Qwerty123!";
                    agent.post("/change_password?type=json")
                        .type("form")
                        .send({
                            "oldPassword": "test",
                            "newPassword": newPassword,
                            "newPasswordConfirm": newPassword
                        })
                        .then((res) => {
                            assert.equal(res.statusCode, 200);
                            assert.equal(res.body.message, "Password changed");
                            checkPassword(TEST_USER, newPassword)
                                .then(() => {
                                    resolve();
                                })
                                .catch((err) => {
                                    reject(err);
                                });
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    });
    it("should prevent user from changing password if they provided the wrong old password", () => {
        return performAsyncTest((resolve, reject) => {
            performUserLogin()
                .then(async (agent) => {
                    await checkPassword(TEST_USER, "test");
                    agent.post("/change_password?type=json")
                        .type("form")
                        .send({
                            "oldPassword": "dsfsd",
                            "newPassword": "Qwerty123!",
                            "newPasswordConfirm": "Qwerty123!"
                        })
                        .then((res) => {
                            assert.equal(res.body.errorID, "oldPasswordIncorrect");
                            assert.fail("Does not check if user password did not change");
                            // resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    });
    it("should prevent user from changing password if the aren't signed in (ie. are guest)", () => {
        return performAsyncTest(async (resolve, reject) => {
            await checkPassword(TEST_USER, "test");
            var agent = chai.request.agent(server.app);
            agent.post("/change_password?type=json")
                .type("form")
                .send({
                    "oldPassword": "test",
                    "newPassword": "Qwerty123!",
                    "newPasswordConfirm": "Qwerty123!"
                })
                .then((res) => {
                    assert.equal(res.body.errorID, "notSignedIn");
                    assert.fail("Does not check if user password did not change");
                    resolve();
                })
                .catch((err) => {
                    reject(err);
                });
        });
    });
    it("should prevent user from changing password if old password is not provided", () => {
        return performAsyncTest((resolve, reject) => {
            performUserLogin()
                .then(async (agent) => {
                    await checkPassword(TEST_USER, "test");
                    agent.post("/change_password?type=json")
                        .type("form")
                        .send({
                            "newPassword": "Qwerty123!",
                            "newPasswordConfirm": "Qwerty123!"
                        })
                        .then((res) => {
                            assert.equal(res.body.errorID, "missingOldPassword");
                            assert.fail("Does not check if user password did not change");
                            // resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    });
    it("should prevent user from changing password if new password is not provided", () => {
        return performAsyncTest((resolve, reject) => {
            performUserLogin()
                .then(async (agent) => {
                    await checkPassword(TEST_USER, "test");
                    agent.post("/change_password?type=json")
                        .type("form")
                        .send({
                            "oldPassword": "test",
                            "newPasswordConfirm": "Qwerty123!"
                        })
                        .then((res) => {
                            assert.equal(res.body.errorID, "missingNewPassword");
                            assert.fail("Does not check if user password did not change");
                            // resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    });
    it("should prevent user from changing password if new password confirmation is not provided", () => {
        return performAsyncTest((resolve, reject) => {
            performUserLogin()
                .then(async (agent) => {
                    await checkPassword(TEST_USER, "test");
                    agent.post("/change_password?type=json")
                        .type("form")
                        .send({
                            "oldPassword": "test",
                            "newPassword": "Qwerty123!",
                        })
                        .then((res) => {
                            assert.equal(res.body.errorID, "missingNewPasswordConfirm");
                            assert.fail("Does not check if user password did not change");
                            // resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    });
    it("should prevent user from changing password if new password and its confirmation don't match", () => {
        return performAsyncTest((resolve, reject) => {
            performUserLogin()
                .then(async (agent) => {
                    await checkPassword(TEST_USER, "test");
                    agent.post("/change_password?type=json")
                        .type("form")
                        .send({
                            "oldPassword": "test",
                            "newPassword": "dsfds",
                            "newPasswordConfirm": "Qwerty123!"
                        })
                        .then((res) => {
                            assert.equal(res.body.errorID, "passwordsDoNotMatch");
                            assert.fail("Does not check if user password did not change");
                            // resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    });
    it("should prevent user from changing password if new password is not strong enough", () => {
        return performAsyncTest((resolve, reject) => {
            performUserLogin()
                .then(async (agent) => {
                    await checkPassword(TEST_USER, "test");
                    agent.post("/change_password?type=json")
                        .type("form")
                        .send({
                            "oldPassword": "test",
                            "newPassword": "weak",
                            "newPasswordConfirm": "weak"
                        })
                        .then((res) => {
                            assert.equal(res.body.errorID, "passwordNotStrong");
                            assert.fail("Does not check if user password did not change");
                            // resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    });
    // // TODO both this test and the one after it will require server-side mocking
    it("should prevent user from changing password if user doesn't exist", () => {
        return performAsyncTest((resolve, reject) => {
            performUserLogin()
                .then(async (agent) => {
                    await checkPassword(TEST_USER, "test");
                    usersCollection = db.collection("users");
                    usersCollection.remove({ username: TEST_USER }, true)
                        .then((result) => {
                            agent.post("/change_password?type=json")
                                .type("form")
                                .send({
                                    "oldPassword": "test",
                                    "newPassword": newPassword,
                                    "newPasswordConfirm": newPassword
                                })
                                .then((res) => {
                                    assert.fail("Does not check if user password did not change");
                                    resolve();
                                })
                                .catch((err) => {
                                    reject(err);
                                });
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    });
    it("should not change password if changing password encountered an error", (done) => {
        assert.fail("Not implemented");
    });
    it("should not change password if there was an error retrieving session user info from db", () => {
        return performAsyncTest((resolve, reject) => {
            performUserLogin()
                .then(async (agent) => {
                    await checkPassword(TEST_USER, "test");
                    usersCollection = db.collection("users");
                    usersCollection.deleteMany({});
                    agent.post("/change_password?type=json")
                        .type("form")
                        .send({
                            "oldPassword": "test",
                            "newPassword": "Qwerty123!",
                            "newPasswordConfirm": "Qwerty123!"
                        })
                        .then((res) => {
                            assert.equal(res.body.errorID, "sessionUserNotFound");
                            assert.fail("Does not check if user password did not change");
                            // resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        })
        .catch((err) => {
            assert.fail(err);
        });
    });
    afterEach(async function () {
        usersCollection = db.collection("users");
        usersCollection.deleteMany({});
    });
    after(async function() {
        mongod.stop();
    });
});