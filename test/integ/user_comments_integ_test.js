const chai = require("chai");
const chaiHTTP = require("chai-http");
const { stub } = require("sinon");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { getServerAgent, assertUserLogin, addImagesForUser } = require('./integ_test_utils');
const { assert } = chai;

chai.use(chaiHTTP);

// TODO:#119 shut down mongo mem server and remove --exit hopefully

function getUserComments(agent, username) {
    return agent.get(`/users/${username}/comments`);
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
                await assertUserLogin(agent, TEST_USER, "test");
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
            const commentsResult = await getUserComments(agent, TEST_USER);
            assert.equal(commentsResult.statusCode, 200);
            const commentsBody = commentsResult.body;
            assert.equal(commentsBody.status, "success");
            const comments = commentsBody.data;
            assert.equal(comments.length, 1);
            assert.equal(comments[0].username, TEST_USER);
            assert.equal(comments[0].imageID, uploadedImages[0].id);
            assert.equal(comments[0].comment, COMMENT_TEXT);
        });

        it("should return valid image links within the comment response", async () => {
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
            const commentsResult = await getUserComments(agent, TEST_USER);
            assert.equal(commentsResult.statusCode, 200);
            const comments = commentsResult.body.data;
            assert.strictEqual(comments.length, 1);
            assert.strictEqual(comments[0].imagePageURL, `/images/${uploadedImages[0].id}`);
            assert.strictEqual(comments[0].imageURL, `/images/${uploadedImages[0].id}.jpeg`);
        });

        it("should return posted timestamp within the comment response", async () => {
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
            // Get posted comment from response
            const postedComment = writeResult.body.comment;
            // Verify that posted date exists in API response
            const commentsResult = await getUserComments(agent, TEST_USER);
            assert.equal(commentsResult.statusCode, 200);
            const comments = commentsResult.body.data;
            assert.strictEqual(comments.length, 1);
            assert.equal(comments[0].postedDate, postedComment.postedDate);
        });

        it("should return removed image link within comment response if referenced image has been deleted", async () => {
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
            const commentsResult = await getUserComments(agent, TEST_USER);
            assert.equal(commentsResult.statusCode, 200);
            const comments = commentsResult.body.data;
            assert.strictEqual(comments.length, 1);
            assert.strictEqual(comments[0].imageURL, `/images/removed.png`);
        });

        it("should still return a link to the image page within comment response, even if the image has been deleted", async () => {
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
            // Verify that image page link exists in API response
            const commentsResult = await getUserComments(agent, TEST_USER);
            assert.equal(commentsResult.statusCode, 200);
            const comments = commentsResult.body.data;
            assert.strictEqual(comments.length, 1);
            assert.strictEqual(comments[0].imagePageURL, `/images/${uploadedImages[0].id}`);
        });

        it("should return an empty array if no comments are found", async () => {
            // Get comments
            const commentsResult = await getUserComments(agent, TEST_USER);
            assert.equal(commentsResult.statusCode, 200);
            const comments = commentsResult.body.data;
            assert.isArray(comments);
            assert.isEmpty(comments);
        });

        it("should return comment text sanitized", async () => {
            // Add test image under test user
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Write comment with malicious script
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, `<script>alert('Hello there')</script>`);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Verify that comment text is sanitized
            const commentsResult = await getUserComments(agent, TEST_USER);
            assert.equal(commentsResult.statusCode, 200);
            const comments = commentsResult.body.data;
            assert.strictEqual(comments.length, 1);
            assert.strictEqual(comments[0].comment, `&lt;script&gt;alert(&apos;Hello there&apos;)&lt;/script&gt;`);
        });

        it("should fail to return user comments if fail to retrieve comments", async () => {
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
            // Stub databaseOps findCommentsForUser
            const findCommentsForUserStub = stub(databaseOps, "findCommentsForUser").callsArgWith(1, new Error("Error finding image"), null);
            // Verify that comments could not load due to an error
            const commentsResult = await getUserComments(agent, TEST_USER);
            assert.equal(commentsResult.statusCode, 500);
            const response = commentsResult.body;
            assert.strictEqual(response.status, "error");
            assert.strictEqual(response.errorID, "userCommentsError");
            // Verify that databaseOps was called
            assert.equal(findCommentsForUserStub.callCount, 1);
            // Restore original databaseOps findCommentsForUser
            findCommentsForUserStub.restore();
        });

        it("should fail to return user comments if fail to retrieve image entry attributes from database", async () => {
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
            // Stub databaseOps findImageAttributes
            const findImageAttributesStub = stub(databaseOps, "findImageAttributes").callsArgWith(1, new Error("Error finding image"), null);
            // Verify that comments could not load due to an error
            const commentsResult = await getUserComments(agent, TEST_USER);
            assert.equal(commentsResult.statusCode, 500);
            const response = commentsResult.body;
            assert.strictEqual(response.status, "error");
            assert.strictEqual(response.errorID, "imageAttribsError");
            // Verify that databaseOps was called
            assert.equal(findImageAttributesStub.callCount, 1);
            // Restore original databaseOps findImageAttributes
            findImageAttributesStub.restore();
        });
    });
});
