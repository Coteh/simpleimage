const chai = require("chai");
const chaiHTTP = require("chai-http");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require("mongodb");
const { assert } = chai;
const { stub } = require("sinon");
const { getServerAgent, addImagesForUser, assertUserLogin } = require("./integ_test_utils");

chai.use(chaiHTTP);

// TODO:#119 shut down mongo mem server and remove --exit hopefully

const getImageComments = (agent, imageID) => {
    return agent.get(`/images/${imageID}/comments`);
};

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
    describe("image comments", () => {
        var mongod = null;
        var db = null;
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";
        const COMMENT_TEXT = "Hello World";

        it("should return comments for an image", async () => {
            // Add test image under test user
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Login user
            await assertUserLogin(agent, TEST_USER, "test");
            // Write comment on image
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, COMMENT_TEXT);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Verify that comment exists when API request is made
            const commentsResult = await getImageComments(agent, uploadedImages[0].id);
            assert.equal(commentsResult.statusCode, 200);
            const commentsBody = commentsResult.body;
            assert.equal(commentsBody.status, "success");
            const comments = commentsBody.data;
            assert.equal(comments.length, 1);
            assert.equal(comments[0].username, TEST_USER);
            assert.equal(comments[0].imageID, uploadedImages[0].id);
            assert.equal(comments[0].comment, COMMENT_TEXT);
        });

        it("should return posted timestamp within comment", async () => {
            // Add test image under test user
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Login user
            await assertUserLogin(agent, TEST_USER, "test");
            // Write comment on image
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, COMMENT_TEXT);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Get posted comment from response
            const postedComment = writeResult.body.comment;
            // Verify that posted date in comment exists when API request is made
            const commentsResult = await getImageComments(agent, uploadedImages[0].id);
            assert.equal(commentsResult.statusCode, 200);
            const commentsBody = commentsResult.body;
            assert.equal(commentsBody.status, "success");
            const comments = commentsBody.data;
            assert.equal(comments.length, 1);
            assert.equal(comments[0].imageID, uploadedImages[0].id);
            assert.equal(comments[0].postedDate, postedComment.postedDate);
        });

        it("should return comment text sanitized", async () => {
            // Add test image under test user
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Login user
            await assertUserLogin(agent, TEST_USER, "test");
            // Write comment with malicious script
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, `<script>alert("Hello World")</script>`);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Verify that comment exists when API request is made
            const commentsResult = await getImageComments(agent, uploadedImages[0].id);
            assert.equal(commentsResult.statusCode, 200);
            const commentsBody = commentsResult.body;
            assert.equal(commentsBody.status, "success");
            const comments = commentsBody.data;
            assert.equal(comments.length, 1);
            assert.equal(comments[0].username, TEST_USER);
            assert.equal(comments[0].imageID, uploadedImages[0].id);
            assert.equal(comments[0].comment, "&lt;script&gt;alert(&quot;Hello World&quot;)&lt;/script&gt;");
        });

        it("should fail to return image comments if fail to retrieve comments from database", async () => {
            // Add test image under test user
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Login user
            await assertUserLogin(agent, TEST_USER, "test");
            // Write comment on image
            const writeResult = await writeComment(agent, TEST_USER, uploadedImages[0].id, COMMENT_TEXT);
            if (writeResult.statusCode !== 200) {
                assert.fail(`Could not write comment, status code: ${writeResult.statusCode}, resp: ${JSON.stringify(writeResult.body)}`);
            }
            // Stub databaseOps to fail to retrieve comments
            const findCommentsForImageStub = stub(databaseOps, "findCommentsForImage").callsArgWith(1, new Error("Error finding image"), null);
            // Verify that server returns error when retrieving comments
            const commentsResult = await getImageComments(agent, uploadedImages[0].id);
            assert.equal(commentsResult.statusCode, 500);
            const commentsBody = commentsResult.body;
            assert.strictEqual(commentsBody.status, "error");
            assert.strictEqual(commentsBody.errorID, "imageCommentsError");
            assert.isUndefined(commentsBody.data);
            // Verify that databaseOps was called
            assert.equal(findCommentsForImageStub.callCount, 1);
            // Restore original databaseOps findCommentsForImage
            findCommentsForImageStub.restore();
        });

        it("should return empty array when there are no comments on image", async () => {
            // Add test image under test user
            const uploadedImages = await addImagesForUser([
                {
                    fileName: "Black_tea_pot_cropped.jpg",
                    mimeType: "image/jpeg",
                },
            ], TEST_USER);
            // Get comments for image
            const commentsResult = await getImageComments(agent, uploadedImages[0].id);
            assert.equal(commentsResult.statusCode, 200);
            // Verify there is an empty array signifying no comments for image
            assert.isArray(commentsResult.body.data);
            assert.isEmpty(commentsResult.body.data);
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
    });
});
