const chai = require("chai");
const chaiHTTP = require("chai-http");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { assert } = chai;
const { stub } = require("sinon");
const fs = require('fs');
const { getServerAgent, assertUserLogin, assertBuffers } = require('./integ_test_utils');

chai.use(chaiHTTP);

// NOTE: These tests will unset LOGIN_TO_UPLOAD, EVALUATION_MODE, and EXPIRE_AFTER_SECONDS env vars

// TODO:#119 shut down mongo mem server and remove --exit hopefully

describe("integ", () => {
    describe("upload", () => {
        var mongod = null;
        var db = null;
        var agent = null;
        let usersCollection;
        let imagesCollection;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "Testing123!@#";

        const jpegImage = fs.readFileSync("./test/assets/images/JPEGtest.jpg");
        const pngImage = fs.readFileSync("./test/assets/images/PNGtest.png");
        const gifImage = fs.readFileSync("./test/assets/images/GIFtest.gif");
        const bmpImage = fs.readFileSync("./test/assets/images/BMPtest.bmp");
        const pdfImage = fs.readFileSync("./test/assets/images/PDFtest.pdf");

        const uploadImage = (agent, buffer, filename) => {
            return agent.post("/upload")
                .attach('image', buffer, filename);
        };

        it("should be able to upload a JPEG", () => {
            imagesCollection = db.collection("image-entries");
            let uploadedImageID;
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                })
                .then(() => {
                    return uploadImage(agent, jpegImage, "test.jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const body = res.body;
                    uploadedImageID = body.id;
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 1);
                    assert.equal(docs[0].id, uploadedImageID);
                    assert.isDefined(docs[0].data);
                    assertBuffers(docs[0].data.buffer, jpegImage);
                });
        });

        it("should be able to upload a PNG", () => {
            imagesCollection = db.collection("image-entries");
            let uploadedImageID;
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                })
                .then(() => {
                    return uploadImage(agent, pngImage, "test.png");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const body = res.body;
                    uploadedImageID = body.id;
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 1);
                    assert.equal(docs[0].id, uploadedImageID);
                    assert.isDefined(docs[0].data);
                    assertBuffers(docs[0].data.buffer, pngImage);
                });
        });

        it("should be able to upload a BMP", () => {
            imagesCollection = db.collection("image-entries");
            let uploadedImageID;
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                })
                .then(() => {
                    return uploadImage(agent, bmpImage, "test.bmp");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const body = res.body;
                    uploadedImageID = body.id;
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 1);
                    assert.equal(docs[0].id, uploadedImageID);
                    assert.isDefined(docs[0].data);
                    assertBuffers(docs[0].data.buffer, bmpImage);
                });
        });

        it("should be able to upload a GIF", () => {
            imagesCollection = db.collection("image-entries");
            let uploadedImageID;
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                })
                .then(() => {
                    return uploadImage(agent, gifImage, "test.gif");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const body = res.body;
                    uploadedImageID = body.id;
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 1);
                    assert.equal(docs[0].id, uploadedImageID);
                    assert.isDefined(docs[0].data);
                    assertBuffers(docs[0].data.buffer, gifImage);
                });
        });

        it("should not be able to upload an invalid file type", () => {
            imagesCollection = db.collection("image-entries");
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                })
                .then(() => {
                    return uploadImage(agent, pdfImage, "test.pdf");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    const body = res.body;
                    assert.equal(body.errorID, "invalidFileType");
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 0);
                });
        });

        it("should upload an image under anonymous (username is empty) if uploaded by guest", () => {
            imagesCollection = db.collection("image-entries");
            let uploadedImageID;
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                })
                .then(() => {
                    return uploadImage(agent, jpegImage, "test.jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const body = res.body;
                    uploadedImageID = body.id;
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 1);
                    assert.equal(docs[0].id, uploadedImageID);
                    assert.isNull(docs[0].username);
                });
        });

        it("should upload an image under the logged in user", () => {
            imagesCollection = db.collection("image-entries");
            let uploadedImageID;
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                    return assertUserLogin(agent, TEST_USER, TEST_PASSWORD);
                })
                .then(() => {
                    return uploadImage(agent, jpegImage, "test.jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const body = res.body;
                    uploadedImageID = body.id;
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 1);
                    assert.equal(docs[0].id, uploadedImageID);
                    assert.equal(docs[0].username, TEST_USER);
                });
        });

        it("should not be able to upload a file if user does not exist", () => {
            imagesCollection = db.collection("image-entries");
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                    return assertUserLogin(agent, TEST_USER, TEST_PASSWORD);
                })
                .then(() => {
                    usersCollection = db.collection("users");
                    return usersCollection.deleteOne({ username: TEST_USER });
                })
                .then((res) => {
                    assert.strictEqual(res.deletedCount, 1);
                    return uploadImage(agent, jpegImage, "test.jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 404);
                    assert.equal(res.body.errorID, "sessionUserNotFound");
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 0);
                });
        });

        it("should fail if login to upload is turned on and user is not logged in when uploading image", () => {
            process.env.LOGIN_TO_UPLOAD = "true";
            imagesCollection = db.collection("image-entries");
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                })
                .then(() => {
                    return uploadImage(agent, jpegImage, "test.jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 401);
                    assert.equal(res.body.errorID, "notSignedIn");
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 0);
                })
                .finally(() => {
                    delete process.env.LOGIN_TO_UPLOAD;
                });
        });

        it("should upload image successfully if login to upload is enabled and user is logged in", () => {
            process.env.LOGIN_TO_UPLOAD = "true";
            imagesCollection = db.collection("image-entries");
            let uploadedImageID;
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                    return assertUserLogin(agent, TEST_USER, TEST_PASSWORD);
                })
                .then(() => {
                    return uploadImage(agent, jpegImage, "test.jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const body = res.body;
                    uploadedImageID = body.id;
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 1);
                    assert.equal(docs[0].id, uploadedImageID);
                    assert.equal(docs[0].username, TEST_USER);
                })
                .finally(() => {
                    delete process.env.LOGIN_TO_UPLOAD;
                });
        });

        // TODO add integ test for evaluation mode image upload being automatically removed after timeout
        // I think it requires true Mongo
        // it("should remove image after EXPIRE_AFTER_SECONDS second if evaluation mode is enabled", () => {})

        // some code I wrote for this test case commented below, may reuse if I figure this out
        // return new Promise(resolve => {
        //     /*
        //         "The TTL index does not guarantee that expired data will be deleted immediately upon expiration.
        //         There may be a delay between the time a document expires and the time that MongoDB removes the 
        //         document from the database.

        //         The background task that removes expired documents runs every 60 seconds.
        //         As a result, documents may remain in a collection during the period between the expiration of the document
        //         and the running of the background task."
        //         - https://docs.mongodb.com/manual/core/index-ttl/"
        //     */
        // //    TODO see if mongodb mem server supports this
        //     let count = 0;
        //     setInterval(async () => {
        //         const docs = await imagesCollection.find().toArray();
        //         if (docs.length === 0) {
        //             resolve();
        //         }
        //         console.log(++count);
        //     }, 1000);
        // });

        it("should mark uploaded image as temporary if evaluation mode is enabled", () => {
            process.env.EVALUATION_MODE = "true";
            imagesCollection = db.collection("image-entries");
            let uploadedImageID;
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                    return assertUserLogin(agent, TEST_USER, TEST_PASSWORD);
                })
                .then(() => {
                    return uploadImage(agent, jpegImage, "test.jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const body = res.body;
                    uploadedImageID = body.id;
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 1);
                    assert.equal(docs[0].id, uploadedImageID);
                    assert.isDefined(docs[0].data);
                    assertBuffers(docs[0].data.buffer, jpegImage);
                    assert.isTrue(docs[0].temp);
                })
                .finally(() => {
                    delete process.env.EVALUATION_MODE;
                });
        });

        it("should not mark image as temporary if evaluation mode is not enabled", () => {
            imagesCollection = db.collection("image-entries");
            let uploadedImageID;
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                    return assertUserLogin(agent, TEST_USER, TEST_PASSWORD);
                })
                .then(() => {
                    return uploadImage(agent, jpegImage, "test.jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const body = res.body;
                    uploadedImageID = body.id;
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 1);
                    assert.equal(docs[0].id, uploadedImageID);
                    assert.isDefined(docs[0].data);
                    assertBuffers(docs[0].data.buffer, jpegImage);
                    assert.isFalse(docs[0].temp);
                });
        });

        it("should fail if no files were sent for upload", () => {
            imagesCollection = db.collection("image-entries");
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                    return assertUserLogin(agent, TEST_USER, TEST_PASSWORD);
                })
                .then(() => {
                    return agent.post("/upload")
                        .set("Content-Type", "multipart/form-data; boundary=X-INTEGTEST-BOUNDARY")
                        .send("--X-INTEGTEST-BOUNDARY--");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "noFilesSelected");
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 0);
                });
        });

        it("should fail gracefully if non-multipart request was sent", () => {
            imagesCollection = db.collection("image-entries");
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                    return assertUserLogin(agent, TEST_USER, TEST_PASSWORD);
                })
                .then(() => {
                    return agent.post("/upload")
                        .send();
                })
                .then((res) => {
                    assert.equal(res.statusCode, 400);
                    assert.equal(res.body.errorID, "noFilesSelected");
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 0);
                });
        });

        it("should fail if database failed when writing image", () => {
            const addImageStub = stub(databaseOps, "addImage").callsArgWith(1, new Error("Error adding image"), null);
            imagesCollection = db.collection("image-entries");
            return imagesCollection.find().toArray()
                .then((docs) => {
                    assert.equal(docs.length, 0);
                })
                .then(() => {
                    return uploadImage(agent, jpegImage, "test.jpg");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 500);
                    return imagesCollection.find().toArray();
                })
                .then((docs) => {
                    assert.equal(docs.length, 0);
                    assert.isTrue(addImageStub.calledOnce);
                })
                .finally(() => {
                    addImageStub.restore();
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

        beforeEach((done) => {
            databaseOps.addUser({
                username: TEST_USER,
                password: TEST_PASSWORD,
                email: "test@test.com"
            }, () => {
                agent = getServerAgent();
                done();
            });
            // TODO add a config to simpleimage so that environment variables don't need to be manipulated for tests
            delete process.env.LOGIN_TO_UPLOAD;
            delete process.env.EVALUATION_MODE;
            delete process.env.EXPIRE_AFTER_SECONDS;
        });

        afterEach(() => {
            usersCollection = db.collection("users");
            usersCollection.deleteMany({});
            imagesCollection = db.collection("image-entries");
            imagesCollection.deleteMany({});
            agent.close();
        });

        after(() => {
            mongod.stop();
            databaseOps.closeDatabaseClient();
        });
    });
});
