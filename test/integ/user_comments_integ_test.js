const chai = require("chai");
const chaiHTTP = require("chai-http");
const { stub } = require("sinon");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { performUserLogin, addImagesForUser } = require('./integ_test_utils');
const { assert } = chai;
const { HtmlValidate } = require('html-validate');

chai.use(chaiHTTP);

const htmlValidate = new HtmlValidate({
    root: true,
    extends: ["html-validate:recommended"],
    rules: {
        "close-order": "error",
        "no-inline-style": "off",
    },
});

// TODO:#119 shut down mongo mem server and remove --exit hopefully

function getServerAgent() {
    return chai.request.agent(server.app);
}

function getUserComments(agent, username, type) {
    return agent.get(`/users/${username}/comments`)
        .accept(type)
        .query({
            type,
        });
}

function writeComment(agent, username, imageID, comment) {
    return agent.post("/comment")
        .accept("json")
        .query({
            type: "json",
        })
        .send({
            imageID,
            comment,
        });
}

function deleteImage(agent, imageID) {
    return agent.delete(`/images/${imageID}`)
        .send();
}

describe("integ", () => {
    describe("user comments", () => {
        var mongod = null;
        var db = null;
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";
        const COMMENT_TEXT = "Hello World";

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
                password: "test",
                email: "test@test.com"
            }, async () => {
                agent = getServerAgent();
                await performUserLogin(agent, TEST_USER, "test");
                done();
            });
        });

        afterEach(() => {
            usersCollection = db.collection("users");
            usersCollection.deleteMany({});
            imageCollection = db.collection("image-entries");
            imageCollection.deleteMany({});
            commentsCollection = db.collection("comments");
            commentsCollection.deleteMany({});
            agent.close();
        });

        after(() => {
            mongod.stop();
            databaseOps.closeDatabaseClient();
        });

        it("should return comments written by the user in JSON format", async () => {
            // Upload an image
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Write comment on image
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, COMMENT_TEXT);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Verify that comment exists when API request is made
            const commentsResult = await getUserComments(agent, TEST_USER, "json");
            assert.equal(commentsResult.statusCode, 200);
            const commentsBody = commentsResult.body;
            assert.equal(commentsBody.result_count, 1);
            const comments = commentsBody.results;
            assert.equal(comments[0].username, TEST_USER);
            assert.equal(comments[0].imageID, uploadedImages[0].id);
            assert.equal(comments[0].comment, COMMENT_TEXT);
        });

        it("should return valid HTML when returned in HTML format", async () => {
            // Upload an image
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Write comment on image
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, COMMENT_TEXT);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Verify that HTML returned from API request is valid
            const commentsResult = await getUserComments(agent, TEST_USER, "html");
            assert.equal(commentsResult.statusCode, 200);
            const commentsBody = commentsResult.text;
            const validateReport = htmlValidate.validateString(commentsBody);
            assert.ok(validateReport.valid, `HTML is not valid: ${JSON.stringify(validateReport.results, null, 2)}`);
        });

        it("should return comments written by the user in HTML format", async () => {
            // Upload an image
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Write comment on image
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, COMMENT_TEXT);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Verify that comment exists when API request is made
            const commentsResult = await getUserComments(agent, TEST_USER, "html");
            assert.equal(commentsResult.statusCode, 200);
            const commentsBody = commentsResult.text;
            assert.match(commentsBody, new RegExp(COMMENT_TEXT, "g"));
        });

        it("should return valid image links within the comment HTML", async () => {
            // Upload an image
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Write comment on image
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, COMMENT_TEXT);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Verify that image link exists in API response
            const commentsResult = await getUserComments(agent, TEST_USER, "html");
            assert.equal(commentsResult.statusCode, 200);
            const commentsBody = commentsResult.text;
            assert.match(commentsBody, new RegExp(`"/images/${uploadedImages[0].id}"`, "g"));
            assert.match(commentsBody, new RegExp(`"/images/${uploadedImages[0].id}.jpeg"`, "g"));
        });

        it("should return removed image link within comment HTML if referenced image has been deleted", async () => {
            // Upload an image
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Write comment on image
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, COMMENT_TEXT);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Delete image
            const deleteResult = await deleteImage(agent, uploadedImages[0].id);
            if (deleteResult.statusCode !== 200) {
                assert.fail(`Could not delete image, status code: ${deleteResult.statusCode}, resp: ${JSON.stringify(deleteResult.body)}`);
            }
            // Verify that 'removed' image link exists in API response
            const commentsResult = await getUserComments(agent, TEST_USER, "html");
            assert.equal(commentsResult.statusCode, 200);
            const commentsBody = commentsResult.text;
            assert.match(commentsBody, new RegExp(`"/images/${uploadedImages[0].id}"`, "g"));
            assert.match(commentsBody, new RegExp(`"/images/removed.png"`, "g"));
        });
    });
});
