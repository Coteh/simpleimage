const chai = require("chai");
const chaiHTTP = require("chai-http");
const { assert } = require("chai");

const databaseOps = require("../../lib/database-ops");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { Agent } = require("http");
const server = require("../../lib/server");
const { promisify } = require("util");

const integTestUtils = require('./integ_test_utils');

chai.use(chaiHTTP);
chai.should();

function getServerAgent() {
    return chai.request.agent(server.app);
}

describe("integ", () => {
    describe("user images", () => {
        let imagesLookup = new Map();
        let mongod;

        const findImagesForUserPromise = promisify(databaseOps.findImagesForUser);

        function performUserImageRequest(user) {
            return new Promise((resolve, reject) => {
                let agent = getServerAgent();
                agent.get(`/users/${user}/images`)
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

        before(async function () {
            return new Promise(async (resolve) => {
                mongod = new MongoMemoryServer();
                await mongod.getUri();
                await mongod.getPort();
                await mongod.getDbPath();
                await mongod.getDbName();
                const testDBURL = mongod.getInstanceInfo().uri;
                db = await MongoClient.connect(testDBURL);
                databaseOps.startDatabaseClient(function (err) {
                    if (err) {
                        console.error(err);
                        return;
                    }
    
                    databaseOps.addUser({
                        username: "test-user",
                        password: "test",
                        email: "test@test.com"
                    }, () => {
                        integTestUtils.addImagesForUser([
                            {
                                fileName: "Black_tea_pot_cropped.jpg",
                                mimeType: "image/jpeg",
                            },
                            {
                                fileName: "Ingranaggio.png",
                                mimeType: "image/png",
                            },
                            {
                                fileName: "1525676723.png",
                                mimeType: "image/png",
                            }
                        ], 'test-user')
                            .then((imgs) => {
                                imgs.forEach(imgResult => {
                                    imagesLookup.set(imgResult.id, imgResult);
                                });
                                resolve();
                            });
                    });
                }, {
                    dbURL: testDBURL
                });
            });
        });

        it("should successfully return all images belonging to specified user", () => {
            let resImages;

            return performUserImageRequest("test-user")
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    assert.isOk(res.body.images);
                    assert.equal(res.body.images.length, 3);
                    resImages = res.body.images;
                    return findImagesForUserPromise("test-user");
                })
                .then((images) => {
                    let imgMap = new Map();
                    images.forEach((img) => {
                        imgMap.set(img.id, img.data);
                    });
                    resImages.forEach((img) => {
                        assert(imgMap.get(img.id).buffer.equals(imagesLookup.get(img.id).data), "Buffers don't match");
                    });
                })
                .catch((err) => {
                    assert.fail(err);
                });
        });
        it("should return no images if user has not uploaded any images", () => {
            databaseOps.addUser({
                username: "user_with_no_images",
                password: "test",
                email: "test@test.com"
            }, () => {
                return performUserImageRequest("user_with_no_images")
                .then((res) => {
                    assert.equal(res.statusCode, 404);
                    assert.isUndefined(res.body.images);
                })
                .catch((err) => {
                    assert.fail(err);
                });
            });
        });
        it("should return no images if user does not exist", () => {
            return performUserImageRequest("does_not_exist")
                .then((res) => {
                    assert.equal(res.statusCode, 404);
                    assert.isUndefined(res.body.images);
                })
                .catch((err) => {
                    assert.fail(err);
                });
        });
        it("should return an error if user parameter not specified", () => {
            return performUserImageRequest()
                .then((res) => {
                    assert.equal(res.statusCode, 404);
                    assert.isUndefined(res.body.images);
                })
                .catch((err) => {
                    assert.fail(err);
                });
        });

        afterEach(async function () {
            usersCollection = db.collection("users");
            usersCollection.deleteMany({
                username: {
                    $not: new RegExp("test-user"),
                }
            });
        });
        after(async function() {
            mongod.stop();
            databaseOps.closeDatabaseClient();
        });
    });
});