const { stub } = require("sinon");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { assert } = require("chai");
const { getServerAgent, addUser, assertUserLogin, addImagesForUser, assertBuffers } = require('./integ_test_utils');
const fs = require("fs");

// TODO:#119 shut down mongo mem server and remove --exit hopefully

describe("integ", () => {
    describe("image delete", () => {
        var mongod = null;
        var db = null;
        var agent = null;
        var usersCollection = null;
        let testImage = null;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "Testing123!@#";

        const placeholderImage = fs.readFileSync("./img/ImageDoesNotExist.png");

        const deleteImage = (imageID) => {
            return new Promise((resolve, reject) => {
                agent.delete(`/images/${imageID}`)
                    .send()
                    .then((res) => {
                        resolve(res);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        };

        // TODO make this a util
        function fetchImage(imageID, ext) {
            return new Promise((resolve, reject) => {
                agent.get(`/images/${imageID}.${ext}`)
                    .then((res) => {
                        if (res.statusCode !== 200) {
                            resolve({
                                statusCode: res.statusCode,
                            });
                            return;
                        }
                        resolve(res.body);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        }

        it("should delete an image successfully", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return fetchImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, testImage.data);
                })
                .then(() => {
                    return deleteImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                })
                .then(() => {
                    return fetchImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, placeholderImage);
                });
        });

        it("should not be able to delete an image if it's not owned by the user", () => {
            const altUsername = "user-2";
            const altUserPass = "test";
            const altUserEmail = "user2@example.com";
            return addUser(altUsername, altUserPass, altUserEmail)
                .then(() => {
                    return assertUserLogin(agent, altUsername, altUserPass);
                })
                .then(() => {
                    return fetchImage(testImage.id, "jpg")
                })
                .then((res) => {
                    assertBuffers(res, testImage.data);
                })
                .then(() => {
                    return deleteImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 403);
                })
                .then(() => {
                    return fetchImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, testImage.data);
                });
        });

        it("should not be able to delete an image if it's nonexistent", () => {
            const nonexistentImageId = `${testImage.id}_notreal`;
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return fetchImage(nonexistentImageId, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, placeholderImage);
                })
                .then(() => {
                    return deleteImage(nonexistentImageId, "jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 404);
                })
                .then(() => {
                    return fetchImage(nonexistentImageId, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, placeholderImage);
                });
        });

        it("should not be able to delete an image if not logged in", () => {
            return fetchImage(testImage.id, "jpg")
                .then((res) => {
                    assertBuffers(res, testImage.data);
                })
                .then(() => {
                    return deleteImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 401);
                    assert.equal(res.body.errorID, "notLoggedIn");
                })
                .then(() => {
                    return fetchImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, testImage.data);
                });
        });

        it("should fail deleting image if database error occurs when deleting image", () => {
            const databaseOpsStub = stub(databaseOps, "deleteImage").callsArgWith(1, new Error("Error finding image"), null);
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return fetchImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, testImage.data);
                })
                .then(() => {
                    return deleteImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 500);
                })
                .then(() => {
                    return fetchImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, testImage.data);
                    assert.isTrue(databaseOpsStub.calledOnce);
                })
                .finally(() => {
                    databaseOpsStub.restore();
                });
        });

        it("should not be able to delete an image if user that owns image no longer exists", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return fetchImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, testImage.data);
                    usersCollection = db.collection("users");
                    return usersCollection.deleteOne({ username: TEST_USER });
                })
                .then((res) => {
                    assert.strictEqual(res.deletedCount, 1);
                    return deleteImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 404);
                    assert.equal(res.body.errorID, "sessionUserNotFound");
                })
                .then(() => {
                    return fetchImage(testImage.id, "jpg");
                })
                .then((res) => {
                    assertBuffers(res, testImage.data);
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

        beforeEach(() => {
            return addUser(TEST_USER, TEST_PASSWORD, "test@test.com")
                .then(() => {
                    return addImagesForUser([
                        {
                            fileName: "Black_tea_pot_cropped.jpg",
                            mimeType: "image/jpeg",
                        },
                    ], TEST_USER);
                })
                .then((imgs) => {
                    assert.equal(imgs.length, 1);
                    testImage = imgs[0];
                    agent = getServerAgent();
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
