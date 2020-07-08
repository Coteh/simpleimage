const chai = require("chai");
const chaiHTTP = require("chai-http");
const { assert } = require("chai");
const fs = require("fs");

const databaseOps = require("../../lib/database-ops");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { Agent } = require("http");
const server = require("../../lib/server");

chai.use(chaiHTTP);
chai.should();

function getServerAgent() {
    return chai.request.agent(server.app);
}

describe("integ", () => {
    describe("user images", () => {
        let imagesArr = [];
        const TEST_USER = "test-user";

        function performUserImageRequest(user) {
            return new Promise((resolve, reject) => {
                agent = getServerAgent();
                agent.get(`/users/${user}/images`)
                    .send()
                    .then((res) => {
                        resolve(res);
                    })
                    .catch((err) => {
                        reject(err);
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
            return databaseOps.startDatabaseClient(function (err) {
                if (err) {
                    console.error(err);
                    return;
                }

                const imageInfoArr = [
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
                ];
                imageInfoArr.forEach(function(item) {
                    var imageFile = fs.readFileSync("./test/assets/images/" + item.fileName + "");
                    imagesArr.push(Object.assign({
                        imageBuffer: imageFile,
                        mimeType: item.mimeType
                    }, item));
                });

                imagesArr.forEach((image) => {
                    databaseOps.addImage({
                        data: image.imageBuffer,
                        mimetype: image.mimeType,
                        encoding: "7bit",
                        username: TEST_USER
                    }, (err, result) => {
                        if (err) {
                            assert.fail("Error uploading test image");
                        }
                    });
                });
            }, {
                dbURL: testDBURL
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

        it("should successfully return all images belonging to specified user", () => {
            return performUserImageRequest(TEST_USER)
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    assert.isOk(res.body.images);
                    assert.equal(res.body.images.length, 3);
                })
                .catch((err) => {
                    assert.fail(err);
                });
        });
        it("should return no images if user has not uploaded any images", () => {
            assert.fail("Not implemented");
        });
        it("should return no images if user does not exist", () => {
            assert.fail("Not implemented");
        });
        it("should return an error if user parameter not specified", () => {
            assert.fail("Not implemented");
        });
    });
});