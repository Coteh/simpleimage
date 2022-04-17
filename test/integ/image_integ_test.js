const chai = require("chai");
const chaiHTTP = require("chai-http");
const { stub } = require("sinon");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { assert } = chai;
const fs = require("fs");
const {
    getServerAgent,
    addImagesForUser,
    getImageExt,
    MongoMemoryTestClient,
} = require("./integ_test_utils");

chai.use(chaiHTTP);

// TODO:#119 shut down mongo mem server and remove --exit hopefully

describe("integ", () => {
    describe("images", () => {
        let mongoTestClient = new MongoMemoryTestClient();
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";

        const placeholderImage = fs.readFileSync("./img/ImageDoesNotExist.png");
        const imagesLookupByExt = new Map();

        function fetchImage(imageID, ext) {
            return new Promise((resolve, reject) => {
                agent
                    .get(`/images/${imageID}.${ext}`)
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
                    })
                    .finally(() => {
                        agent.close();
                    });
            });
        }

        it("should return PNG image data if it exists", () => {
            return fetchImage(imagesLookupByExt.get("png").id, "png").then((img) => {
                assert(img.equals(imagesLookupByExt.get("png").data), "Buffers don't match");
            });
        });

        it("should return JPEG image data if it exists", () => {
            return fetchImage(imagesLookupByExt.get("jpeg").id, "jpeg").then((img) => {
                assert(img.equals(imagesLookupByExt.get("jpeg").data), "Buffers don't match");
            });
        });

        it("should return GIF image data if it exists", () => {
            return fetchImage(imagesLookupByExt.get("gif").id, "gif").then((img) => {
                assert(img.equals(imagesLookupByExt.get("gif").data), "Buffers don't match");
            });
        });

        it("should return BMP image data if it exists", () => {
            return fetchImage(imagesLookupByExt.get("bmp").id, "bmp").then((img) => {
                assert(img.equals(imagesLookupByExt.get("bmp").data), "Buffers don't match");
            });
        });

        it("should return placeholder image indicating that image does not exist if image does not exist", () => {
            return fetchImage("something", "png").then((img) => {
                assert(img.equals(placeholderImage), "Buffers don't match");
            });
        });

        it("should return placeholder image if 'removed.png' is accessed", () => {
            return fetchImage("removed", "png").then((img) => {
                assert(img.equals(placeholderImage), "Buffers don't match");
            });
        });

        it("should return placeholder image indicating that image does not exist if no filename was passed in", () => {
            return fetchImage(undefined, "png").then((img) => {
                assert(img.equals(placeholderImage), "Buffers don't match");
            });
        });

        it("should return 500 status code if database encountered an error when searching for image", () => {
            const databaseOpsStub = stub(databaseOps, "findImage").callsArgWith(
                1,
                new Error("Error finding image"),
                null
            );
            return fetchImage(imagesLookupByExt.get("png").id, "png")
                .then((res) => {
                    assert.equal(res.statusCode, 500);
                })
                .finally(() => {
                    databaseOpsStub.restore();
                });
        });

        it("should return placeholder image if incorrect extension for image is provided", () => {
            return fetchImage(imagesLookupByExt.get("png").id, "jpeg").then((img) => {
                assert(img.equals(placeholderImage), "Buffers don't match");
            });
        });

        before(async () => {
            await mongoTestClient.initConnection();
            return new Promise(async (resolve) => {
                databaseOps.addUser(
                    {
                        username: "test-user",
                        password: "test",
                        email: "test@test.com",
                    },
                    () => {
                        addImagesForUser(
                            [
                                {
                                    fileName: "PNGtest.png",
                                    mimeType: "image/png",
                                },
                                {
                                    fileName: "JPEGtest.jpg",
                                    mimeType: "image/jpeg",
                                },
                                {
                                    fileName: "BMPtest.bmp",
                                    mimeType: "image/bmp",
                                },
                                {
                                    fileName: "GIFtest.gif",
                                    mimeType: "image/gif",
                                },
                            ],
                            "test-user"
                        ).then((imgs) => {
                            imgs.forEach((imgResult) => {
                                imagesLookupByExt.set(getImageExt(imgResult.mimetype), imgResult);
                            });
                            resolve();
                        });
                    }
                );
            });
        });

        beforeEach((done) => {
            databaseOps.addUser(
                {
                    username: TEST_USER,
                    password: "test",
                    email: "test@test.com",
                },
                () => {
                    agent = getServerAgent();
                    done();
                }
            );
        });

        afterEach(() => {
            usersCollection = mongoTestClient.db.collection("users");
            usersCollection.deleteMany({});
            agent.close();
        });

        after(() => {
            return mongoTestClient.deinitConnection();
        });
    });
});
