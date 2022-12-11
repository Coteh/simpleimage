const databaseOps = require("../../lib/database-ops");
const fs = require("fs");
const { assert } = require("chai");
const server = require("../../lib/server");
const chai = require("chai");
const chaiHTTP = require("chai-http");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient } = require("mongodb");

chai.use(chaiHTTP);

module.exports.MongoMemoryTestClient = class {
    constructor() {
        this.mongod = new MongoMemoryServer();
    }
    async initConnection() {
        await Promise.all([
            this.mongod.getUri(),
            this.mongod.getPort(),
            this.mongod.getDbPath(),
            this.mongod.getDbName(),
        ]);
        const testDBURL = this.mongod.getInstanceInfo().uri;
        this.db = await MongoClient.connect(testDBURL);
        return new Promise((resolve, reject) => {
            return databaseOps.startDatabaseClient(
                function (err) {
                    if (err) {
                        console.error(err);
                        return reject(err);
                    }
                    resolve();
                },
                {
                    dbURL: testDBURL,
                }
            );
        });
    }
    async deinitConnection() {
        this.mongod.stop();
        databaseOps.closeDatabaseClient();
    }
};

module.exports.getServerAgent = () => {
    return chai.request.agent(server.app);
};

// TODO refactor all usages of databaseOps.addUser in tests to use this instead
module.exports.addUser = (user, password, email) => {
    return new Promise((resolve, reject) => {
        databaseOps.addUser(
            {
                username: user,
                password: password,
                email: email,
            },
            (err) => {
                if (err) {
                    return reject(new Error(`User could not be created ${JSON.stringify(err)}`));
                }
                resolve();
            }
        );
    });
};

module.exports.loadTestImages = (imageInfoArr) => {
    const imagesArr = [];
    imageInfoArr.forEach(function (item) {
        var imageFile = fs.readFileSync("./test/assets/images/" + item.fileName);
        imagesArr.push(
            Object.assign(
                {
                    imageBuffer: imageFile,
                },
                item
            )
        );
    });
    return imagesArr;
};

module.exports.addImagesForUser = (imagesArr, user) => {
    return new Promise((resolve) => {
        const imageResultsArr = [];
        let numAdded = 0;
        imagesArr.forEach((image) => {
            databaseOps.addImage(
                {
                    data: image.imageBuffer,
                    mimetype: image.mimeType,
                    encoding: "7bit",
                    username: user,
                },
                (err, result) => {
                    if (err) {
                        assert.fail("Error uploading test image");
                    }
                    let imgResult = result.ops[0];
                    imageResultsArr.push(imgResult);
                    numAdded++;
                    if (numAdded >= imagesArr.length) {
                        resolve(imageResultsArr);
                    }
                }
            );
        });
    });
};

module.exports.addImagesForUserFromFile = async (imageInfoArr, user) => {
    const imagesArr = module.exports.loadTestImages(imageInfoArr);
    return await module.exports.addImagesForUser(imagesArr, user);
};

module.exports.assertUserLoggedIn = async (agent) =>
    agent.get("/user").then((res) => assert.isTrue(res.statusCode === 200, "User is not logged in but they should be"));

module.exports.assertUserNotLoggedIn = async (agent) =>
    agent
        .get("/user")
        .then((res) => assert.isFalse(res.statusCode === 200, "User is logged in but they should not be"));

module.exports.assertUserLogin = (agent, username, password) => {
    return new Promise((resolve, reject) => {
        agent
            .post("/login")
            .type("form")
            .send({
                username,
                password,
            })
            .then((res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Cannot log in: resp: ${JSON.stringify(res.body)}`));
                }
                resolve(res);
            })
            .catch((err) => {
                reject(err);
            });
    });
};

module.exports.assertUserExists = (username) => {
    return new Promise((resolve) => {
        databaseOps.findUser(username, (err, result) => {
            if (err) {
                assert.fail("Error was thrown when verifying user");
            }
            assert.isTrue(result.length > 0, `User ${username} does not exist, should exist`);
            assert.strictEqual(result[0].username, username);
            resolve();
        });
    });
};

module.exports.assertUserDoesNotExist = (username) => {
    return new Promise((resolve) => {
        databaseOps.findUser(username, (err, result) => {
            if (err) {
                assert.fail("Error was thrown when verifying user");
            }
            assert.isTrue(result.length === 0, `User ${username} exists, should not exist`);
            resolve();
        });
    });
};

module.exports.assertBuffers = (actualBuffer, expectedBuffer) => {
    assert(actualBuffer.equals(expectedBuffer), "Buffers don't match");
};

// regex lifted from https://stackoverflow.com/a/52869830
module.exports.assertTimestampIsISO8601 = (timestamp) => {
    assert.isTrue(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(timestamp),
        "Invalid timestamp format. Should be ISO 8601."
    );
    assert.strictEqual(new Date(timestamp).toISOString(), timestamp);
};

module.exports.getImageExt = (mimeType) => {
    switch (mimeType) {
        case "image/png":
            return "png";
        case "image/jpeg":
            return "jpeg";
        case "image/bmp":
            return "bmp";
        case "image/gif":
            return "gif";
        case "image/tiff":
            return "tiff";
    }
};
