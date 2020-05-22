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
chai.should();

// TODO shut down mongo mem server and remove --exit hopefully

describe("integ - change password", () => {
    var mongod = null;
    var db = null;
    const TEST_USER = "test-user";

    function performUserLogin() {
        return new Promise((resolve, reject) => {
            var agent = chai.request.agent(server.app);
            agent.post("/login")
                .type("form")
                .send({
                    "username": "test-user",
                    "password": "test"
                })
                .then(() => {
                    resolve(agent);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    function checkPassword(username, password) {
        return new Promise((resolve, reject) => {
            usersCollection = db.collection("users");
            usersCollection.find({ username })
                .toArray((err, users) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (users.length === 0) {
                        reject(new Error("No user found"));
                        return;
                    }
                    const user = users[0];
                    if (bcrypt.compareSync(auth.preHashPassword(password), user.password)) {
                        resolve();
                    } else {
                        reject(new Error("Passwords don't match"));
                    }
                });
        });
    }

    function changePassword(agent, oldPassword, newPassword, newPasswordConfirm) {
        return agent.post("/change_password?type=json")
            .type("form")
            .send({
                "oldPassword": oldPassword,
                "newPassword": newPassword,
                "newPasswordConfirm": newPasswordConfirm
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
    });

    it("should change user password", () => {
        const newPassword = "Qwerty123!";
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                return changePassword(agent, "test", newPassword, newPassword);
            })
            .then((res) => {
                assert.equal(res.statusCode, 200);
                assert.equal(res.body.message, "Password changed");
                return checkPassword(TEST_USER, newPassword);
            })
    });
    it("should not change user password if they provided the wrong old password", () => {
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                return changePassword(agent, "dsfsd", "Qwerty123!", "Qwerty123!")
            })
            .then((res) => {
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.errorID, "oldPasswordIncorrect");
                return checkPassword(TEST_USER, "test");
            })
    });
    it("should not change user password if the aren't signed in (ie. are guest)", () => {
        return checkPassword(TEST_USER, "test")
            .then(() => {
                return changePassword(chai.request.agent(server.app), "test", "Qwerty123!", "Qwerty123!")
            })
            .then((res) => {
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.errorID, "notSignedIn");
                return checkPassword(TEST_USER, "test");
            });
    });
    it("should not change user password if old password is not provided", () => {
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                return changePassword(agent, undefined, "Qwerty123!", "Qwerty123!");
            })
            .then((res) => {
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.errorID, "missingOldPassword");
                return checkPassword(TEST_USER, "test");
            });
    });
    it("should not change user password if new password is not provided", () => {
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                return changePassword(agent, "test", undefined, "Qwerty123!");
            })
            .then((res) => {
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.errorID, "missingNewPassword");
                return checkPassword(TEST_USER, "test");
            })
    });
    it("should not change user password if new password confirmation is not provided", () => {
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                return changePassword(agent, "test", "Qwerty123!", undefined);
            })
            .then((res) => {
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.errorID, "missingNewPasswordConfirm");
                return checkPassword(TEST_USER, "test");
            });
    });
    it("should not change user password if new password and its confirmation don't match", () => {
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                return changePassword(agent, "test", "dsfds", "Qwerty123!");
            })
            .then((res) => {
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.errorID, "passwordsDoNotMatch");
                return checkPassword(TEST_USER, "test");
            });
    });
    it("should not change user password if new password is not strong enough", () => {
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                return changePassword(agent, "test", "weak", "weak");
            })
            .then((res) => {
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.errorID, "passwordNotStrong");
                return checkPassword(TEST_USER, "test");
            });
    });
    it("should not change user password if user doesn't exist", () => {
        var agent;
        return performUserLogin()
            .then(async (res) => {
                await checkPassword(TEST_USER, "test");
                agent = res;
                usersCollection = db.collection("users");
                return usersCollection.deleteOne({ username: TEST_USER })
            })
            .then((res) => {
                assert.strictEqual(res.deletedCount, 1);
                return changePassword(agent, "test", "something", "something");
            })
            .then((res) => {
                assert.equal(res.statusCode, 404);
                assert.equal(res.body.errorID, "sessionUserNotFound");
                return checkPassword(TEST_USER, "test")
                    .then(() => {
                        assert.fail("User should not be in DB");
                    })
                    .catch((err) => {
                        assert.isDefined(err);
                        assert.strictEqual(err.message, "No user found");
                    });
            });
    });
    it("should not change user password if changing password encountered an error", () => {
        var stub;
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                stub = sinon.stub(databaseOps, "changeUserPassword").rejects(new Error("Error changing password"));
                return changePassword(agent, "test", "Qwerty123!", "Qwerty123!");
            })
            .then((res) => {
                stub.restore();
                assert.equal(res.statusCode, 500);
                assert.equal(res.body.errorID, "errorChangingPassword");
                return checkPassword(TEST_USER, "test");
            })
            .catch((err) => {
                stub.restore();
                assert.fail(err);
            });
    });
    it("should not change user password if database error occurs while finding user", () => {
        var stub;
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                stub = sinon.stub(databaseOps, "findUser").callsArgWith(1, new Error("Error finding user"), null);
                return changePassword(agent, "test", "Qwerty123!", "Qwerty123!");
            })
            .then((res) => {
                stub.restore();
                assert.equal(res.statusCode, 500);
                assert.equal(res.body.errorID, "userNotFound");
                return checkPassword(TEST_USER, "test");
            })
            .catch((err) => {
                stub.restore();
                assert.fail(err);
            });
    });
    it("should not change user password if user not found in database", () => {
        var stub;
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                stub = sinon.stub(databaseOps, "findUser").callsArgWith(1, undefined, []);
                return changePassword(agent, "test", "Qwerty123!", "Qwerty123!");
            })
            .then((res) => {
                stub.restore();
                assert.equal(res.statusCode, 500);
                assert.equal(res.body.errorID, "userNotFound");
                return checkPassword(TEST_USER, "test");
            })
            .catch((err) => {
                stub.restore();
                assert.fail(err);
            });
    });
    it("should change user password if user password change successful but action history cannot write entry due to error", () => {
        var stub;
        const newPassword = "Qwerty123!";
        return performUserLogin()
            .then(async (agent) => {
                await checkPassword(TEST_USER, "test");
                stub = sinon.stub(actionHistory, "writeActionHistory").callsArgWith(1, new Error("Could not write action history entry"), null);
                return changePassword(agent, "test", newPassword, newPassword);
            })
            .then((res) => {
                stub.restore();
                assert.equal(res.statusCode, 200);
                sinon.assert.calledOnce(stub);
                assert.equal(res.body.message, "Password changed");
                return checkPassword(TEST_USER, newPassword);
            })
            .catch((err) => {
                stub.restore();
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