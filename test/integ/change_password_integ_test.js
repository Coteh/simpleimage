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
const { getServerAgent, assertUserLogin } = require('./integ_test_utils');

chai.use(chaiHTTP);

// TODO:#119 shut down mongo mem server and remove --exit hopefully

describe("integ", () => {
    describe("change password", () => {
        var mongod = null;
        var db = null;
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "Testing123!@#";

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

        function changePassword(oldPassword, newPassword, newPasswordConfirm) {
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

        it("should change user password", () => {
            const newPassword = "Qwerty123!";
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    return changePassword(TEST_PASSWORD, newPassword, newPassword);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.body.message, "Password changed.");
                    return checkPassword(TEST_USER, newPassword);
                })
        });
        it("should not change user password if they provided the wrong old password", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    return changePassword("dsfsd", "Qwerty123!", "Qwerty123!")
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "oldPasswordIncorrect");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                })
        });
        it("should not change user password if the aren't signed in (ie. are guest)", () => {
            return checkPassword(TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return changePassword(TEST_PASSWORD, "Qwerty123!", "Qwerty123!")
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "notSignedIn");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                });
        });
        it("should not change user password if old password is not provided", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    return changePassword(undefined, "Qwerty123!", "Qwerty123!");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "missingOldPassword");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                });
        });
        it("should not change user password if new password is not provided", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    return changePassword(TEST_PASSWORD, undefined, "Qwerty123!");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "missingNewPassword");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                })
        });
        it("should not change user password if new password confirmation is not provided", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    return changePassword(TEST_PASSWORD, "Qwerty123!", undefined);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "missingNewPasswordConfirm");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                });
        });
        it("should not change user password if new password and its confirmation don't match", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    return changePassword(TEST_PASSWORD, "dsfds", "Qwerty123!");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "passwordsDoNotMatch");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                });
        });
        it('should not change user password if new password is the same as the old password', () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    return changePassword(TEST_PASSWORD, TEST_PASSWORD, TEST_PASSWORD);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "passwordSame");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                });
        });
        it("should not change user password if new password is not strong enough", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    return changePassword(TEST_PASSWORD, "weak", "weak");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "passwordNotStrong");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                });
        });
        it("should not change user password if user doesn't exist", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    usersCollection = db.collection("users");
                    return usersCollection.deleteOne({ username: TEST_USER });
                })
                .then((res) => {
                    assert.strictEqual(res.deletedCount, 1);
                    return changePassword(TEST_PASSWORD, "something", "something");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 404);
                    assert.equal(res.body.errorID, "sessionUserNotFound");
                    return checkPassword(TEST_USER, TEST_PASSWORD)
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
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    stub = sinon.stub(databaseOps, "changeUserPassword").rejects(new Error("Error changing password"));
                    return changePassword(TEST_PASSWORD, "Qwerty123!", "Qwerty123!");
                })
                .then((res) => {
                    stub.restore();
                    assert.equal(res.statusCode, 500);
                    assert.equal(res.body.errorID, "errorChangingPassword");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                })
                .catch((err) => {
                    stub.restore();
                    assert.fail(err);
                });
        });
        it("should not change user password if database error occurs while finding user", () => {
            var stub;
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    stub = sinon.stub(databaseOps, "findUser").callsArgWith(1, new Error("Error finding user"), null);
                    return changePassword(TEST_PASSWORD, "Qwerty123!", "Qwerty123!");
                })
                .then((res) => {
                    stub.restore();
                    assert.equal(res.statusCode, 500);
                    assert.equal(res.body.errorID, "userNotFound");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                })
                .catch((err) => {
                    stub.restore();
                    assert.fail(err);
                });
        });
        it("should not change user password if user not found in database", () => {
            var stub;
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    stub = sinon.stub(databaseOps, "findUser").callsArgWith(1, undefined, []);
                    return changePassword(TEST_PASSWORD, "Qwerty123!", "Qwerty123!");
                })
                .then((res) => {
                    stub.restore();
                    assert.equal(res.statusCode, 500);
                    assert.equal(res.body.errorID, "userNotFound");
                    return checkPassword(TEST_USER, TEST_PASSWORD);
                })
                .catch((err) => {
                    stub.restore();
                    assert.fail(err);
                });
        });
        it("should change user password if user password change successful but action history cannot write entry due to error", () => {
            var stub;
            const newPassword = "Qwerty123!";
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(async () => {
                    await checkPassword(TEST_USER, TEST_PASSWORD);
                    stub = sinon.stub(actionHistory, "writeActionHistory").callsArgWith(1, new Error("Could not write action history entry"), null);
                    return changePassword(TEST_PASSWORD, newPassword, newPassword);
                })
                .then((res) => {
                    stub.restore();
                    assert.equal(res.statusCode, 200);
                    sinon.assert.calledOnce(stub);
                    assert.equal(res.body.message, "Password changed.");
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
            agent.close();
        });
        after(async function() {
            mongod.stop();
            databaseOps.closeDatabaseClient();
        });
    });
});
