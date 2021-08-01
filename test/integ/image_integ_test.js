const chai = require("chai");
const chaiHTTP = require("chai-http");
const { stub } = require("sinon");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { assert } = chai;
const integTestUtils = require('./integ_test_utils');
const fs = require("fs");

chai.use(chaiHTTP);

// TODO:#119 shut down mongo mem server and remove --exit hopefully

function getServerAgent() {
    return chai.request.agent(server.app);
}

function getImageExt(mimeType) {
    switch (mimeType) {
        case "image/png":
            return "png";
        case "image/jpeg":
            return "jpg";
        case "image/bmp":
            return "bmp";
        case "image/gif":
            return "gif";
    }
}

describe("integ", () => {
    describe("images", () => {
        var mongod = null;
        var db = null;
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";

        const placeholderImage = fs.readFileSync("./img/ImageDoesNotExist.png");
        const imagesLookupByExt = new Map();

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
                        agent.close();
                    })
                    .catch((err) => {
                        reject(err);
                        agent.close();
                    });
            });
        }

        before(function () {
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
                        ], 'test-user')
                            .then((imgs) => {
                                imgs.forEach(imgResult => {
                                    imagesLookupByExt.set(getImageExt(imgResult.mimetype), imgResult);
                                });
                                resolve();
                            });
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
                agent = getServerAgent();
                done();
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

        it("should return PNG image data if it exists", () => {
            return fetchImage(imagesLookupByExt.get("png").id, "png")
                .then((img) => {
                    assert(img.equals(imagesLookupByExt.get("png").data), "Buffers don't match");
                });
        });

        it("should return JPEG image data if it exists", () => {
            return fetchImage(imagesLookupByExt.get("jpg").id, "jpg")
                .then((img) => {
                    assert(img.equals(imagesLookupByExt.get("jpg").data), "Buffers don't match");
                });
        });

        it("should return GIF image data if it exists", () => {
            return fetchImage(imagesLookupByExt.get("gif").id, "gif")
                .then((img) => {
                    assert(img.equals(imagesLookupByExt.get("gif").data), "Buffers don't match");
                });
        });

        it("should return BMP image data if it exists", () => {
            return fetchImage(imagesLookupByExt.get("bmp").id, "bmp")
                .then((img) => {
                    assert(img.equals(imagesLookupByExt.get("bmp").data), "Buffers don't match");
                });
        });

        it("should return placeholder image indicating that image does not exist if image does not exist", () => {
            return fetchImage("something", "png")
                .then((img) => {
                    assert(img.equals(placeholderImage), "Buffers don't match");
                });
        });

        it("should return placeholder image if 'removed.png' is accessed", () => {
            return fetchImage("removed", "png")
                .then((img) => {
                    assert(img.equals(placeholderImage), "Buffers don't match");
                });
        });

        it("should return placeholder image indicating that image does not exist if no filename was passed in", () => {
            return fetchImage(undefined, "png")
                .then((img) => {
                    assert(img.equals(placeholderImage), "Buffers don't match");
                });
        });

        it("should return 500 status code if database encountered an error when searching for image", () => {
            const databaseOpsStub = stub(databaseOps, "findImage").callsArgWith(1, new Error("Error finding image"), null);
            return fetchImage(imagesLookupByExt.get("png").id, "png")
                .then((res) => {
                    assert.equal(res.statusCode, 500);
                })
                .finally(() => {
                    databaseOpsStub.restore();
                });
        });

        it("should return placeholder image if incorrect extension for image is provided", () => {
            return fetchImage(imagesLookupByExt.get("png").id, "jpg")
                .then((img) => {
                    assert(img.equals(placeholderImage), "Buffers don't match");
                });
        });
    });
});
