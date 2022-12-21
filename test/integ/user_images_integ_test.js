const chai = require("chai");
const chaiHTTP = require("chai-http");
const { assert } = require("chai");

const databaseOps = require("../../lib/database-ops");
const { Agent } = require("http");
const server = require("../../lib/server");
const { promisify } = require("util");
const { stub } = require("sinon");

const { getServerAgent, addImagesForUserFromFile, getImageExt, MongoMemoryTestClient } = require("./integ_test_utils");

chai.use(chaiHTTP);
chai.should();

describe("integ", () => {
    describe("user images", () => {
        let imagesLookup = new Map();
        let mongoTestClient = new MongoMemoryTestClient();

        const findImagesForUserPromise = promisify(databaseOps.findImagesForUser);

        function performUserImageRequest(user) {
            return new Promise((resolve, reject) => {
                let agent = getServerAgent();
                agent
                    .get(`/users/${user}/images`)
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

        it("should return image ID of each image belonging to user", async () => {
            const res = await performUserImageRequest("test-user");
            assert.equal(res.statusCode, 200);

            const resImages = res.body.data;
            assert.isOk(resImages);
            assert.equal(resImages.length, 3);

            resImages.forEach((img) => {
                assert.isDefined(imagesLookup.get(img.id));
                assert.equal(imagesLookup.get(img.id).id, img.id);
            });
        });

        it("should return image urls of each image belonging to user", async () => {
            const res = await performUserImageRequest("test-user");
            assert.equal(res.statusCode, 200);

            const resImages = res.body.data;
            assert.isOk(resImages);
            assert.equal(resImages.length, 3);

            resImages.forEach((img) => {
                const image = imagesLookup.get(img.id);
                assert.strictEqual(img.imageURL, `/images/${image.id}.${getImageExt(image.mimetype)}`);
            });
        });

        it("should return image page urls of each image belonging to user", async () => {
            const res = await performUserImageRequest("test-user");
            assert.equal(res.statusCode, 200);

            const resImages = res.body.data;
            assert.isOk(resImages);
            assert.equal(resImages.length, 3);

            resImages.forEach((img) => {
                const image = imagesLookup.get(img.id);
                assert.strictEqual(img.url, `/images/${image.id}`);
            });
        });

        it("should return empty image array if user has not uploaded any images", () => {
            return new Promise((resolve) => {
                databaseOps.addUser(
                    {
                        username: "user_with_no_images",
                        password: "test",
                        email: "test@test.com",
                    },
                    resolve
                );
            })
                .then(() => {
                    return performUserImageRequest("user_with_no_images");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    assert.strictEqual(res.body.data.length, 0);
                });
        });

        it("should return no images if user does not exist", () => {
            return performUserImageRequest("does_not_exist").then((res) => {
                assert.equal(res.statusCode, 404);
                assert.isUndefined(res.body.data);
            });
        });

        it("should return an error if user parameter not specified", () => {
            return performUserImageRequest().then((res) => {
                assert.equal(res.statusCode, 404);
                assert.isUndefined(res.body.data);
            });
        });

        it("should fail if database error occurred with retrieving user info", () => {
            // Stub databaseOps.findUser using sinon that calls a callback with an error
            const findUserStub = stub(databaseOps, "findUser").callsArgWith(1, new Error("Database error occurred"));
            return performUserImageRequest("test-user")
                .then((res) => {
                    assert.equal(res.statusCode, 500);
                    assert.strictEqual(res.body.errorID, "userImagesError");
                    assert.isUndefined(res.body.data);
                    // Verify that databaseOps.findUser was called
                    assert.isTrue(findUserStub.calledOnce);
                })
                .finally(() => {
                    findUserStub.restore();
                });
        });

        it("should fail if database error occurred with retrieving image info", () => {
            // Stub databaseOps.findImagesForUser using sinon that calls a callback with an error
            const findImagesForUserStub = stub(databaseOps, "findImagesForUser").callsArgWith(
                1,
                new Error("Database error occurred")
            );
            return performUserImageRequest("test-user")
                .then((res) => {
                    assert.equal(res.statusCode, 500);
                    assert.strictEqual(res.body.errorID, "userImagesError");
                    assert.isUndefined(res.body.data);
                    // Verify that databaseOps.findImagesForUser was called
                    assert.isTrue(findImagesForUserStub.calledOnce);
                })
                .finally(() => {
                    findImagesForUserStub.restore();
                });
        });

        before(async function () {
            await mongoTestClient.initConnection();
            return new Promise(async (resolve) => {
                databaseOps.addUser(
                    {
                        username: "test-user",
                        password: "test",
                        email: "test@test.com",
                    },
                    () => {
                        addImagesForUserFromFile(
                            [
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
                                },
                            ],
                            "test-user"
                        ).then((imgs) => {
                            imgs.forEach((imgResult) => {
                                imagesLookup.set(imgResult.id, imgResult);
                            });
                            resolve();
                        });
                    }
                );
            });
        });

        afterEach(async function () {
            usersCollection = mongoTestClient.db.collection("users");
            usersCollection.deleteMany({
                username: {
                    $not: new RegExp("test-user"),
                },
            });
        });

        after(() => {
            return mongoTestClient.deinitConnection();
        });
    });
});
