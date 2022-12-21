const chai = require("chai");
const databaseOps = require("../../lib/database-ops");
const actionHistory = require("../../lib/action-history");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { assert } = require("chai");
const { stub } = require("sinon");
const {
    getServerAgent,
    addUser,
    assertUserLogin,
    addImagesForUserFromFile,
    assertBuffers,
    MongoMemoryTestClient,
} = require("./integ_test_utils");

// TODO:#119 shut down mongo mem server and remove --exit hopefully

describe("integ", () => {
    describe("post comment", () => {
        let mongoTestClient = new MongoMemoryTestClient();
        var agent = null;
        var usersCollection = null;
        let testImage = null;
        const TEST_USER = "test-user";
        const TEST_PASSWORD = "Testing123!@#";
        const TEST_COMMENT = "What a wonderful image!";

        // TODO make this a util function
        function postComment(agent, imageID, comment) {
            return agent.post("/comment").send({
                imageID,
                comment,
            });
        }

        // TODO make this a util function
        function getImageComments(agent, imageID) {
            return agent.get(`/images/${imageID}/comments`).query();
        }

        it("should be able to post a comment successfully", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                })
                .then(() => {
                    return postComment(agent, testImage.id, TEST_COMMENT);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const comment = res.body.comment;
                    assert.equal(comment.username, TEST_USER);
                    assert.equal(comment.comment, TEST_COMMENT);
                })
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.equal(res.body.data.length, 1);
                    assert.equal(res.body.data[0].username, TEST_USER);
                    assert.equal(res.body.data[0].comment, TEST_COMMENT);
                });
        });

        it("should not be able to post a comment when not logged in", () => {
            return getImageComments(agent, testImage.id)
                .then((res) => {
                    assert.isEmpty(res.body.data);
                })
                .then(() => {
                    return postComment(agent, testImage.id, TEST_COMMENT);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 401);
                })
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                });
        });

        it("should not be able to post a comment when user no longer exists", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                    usersCollection = mongoTestClient.db.collection("users");
                    return usersCollection.deleteOne({ username: TEST_USER });
                })
                .then((res) => {
                    assert.strictEqual(res.deletedCount, 1);
                    return postComment(agent, testImage.id, TEST_COMMENT);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 404);
                    assert.equal(res.body.errorID, "sessionUserNotFound");
                })
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                });
        });

        it("should not be able to post an empty comment", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                })
                .then(() => {
                    return postComment(agent, testImage.id, "");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 422);
                    assert.equal(res.body.status, "error");
                    assert.equal(res.body.errorID, "missingComment");
                })
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                });
        });

        it("should not be able to post a comment on a deleted image", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                    const imagesCollection = mongoTestClient.db.collection("image-entries");
                    return imagesCollection.deleteOne({ id: testImage.id });
                })
                .then((res) => {
                    assert.strictEqual(res.deletedCount, 1);
                    return postComment(agent, testImage.id, TEST_COMMENT);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 404);
                })
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                });
        });

        it("should return comment text sanitized in comment post response", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return postComment(agent, testImage.id, "<script>alert('hello')</script>");
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const comment = res.body.comment;
                    assert.equal(comment.comment, "&lt;script&gt;alert(&apos;hello&apos;)&lt;/script&gt;");
                });
        });

        it("should not be able to post a comment if image ID is undefined", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                })
                .then(() => {
                    return postComment(agent, undefined, TEST_COMMENT);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 422);
                    assert.equal(res.body.errorID, "missingImageID");
                })
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                });
        });

        it("should not be able to post a comment if comment text is undefined", () => {
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                })
                .then(() => {
                    return postComment(agent, testImage.id, undefined);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 422);
                    assert.equal(res.body.errorID, "missingComment");
                })
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                });
        });

        it("should fail if database error when posting comment", () => {
            const addCommentStub = stub(databaseOps, "addComment").callsArgWith(
                1,
                new Error("Error adding comment to image"),
                null
            );
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                })
                .then(() => {
                    return postComment(agent, testImage.id, TEST_COMMENT);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 500);
                })
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                    assert.isTrue(addCommentStub.calledOnce);
                })
                .finally(() => {
                    addCommentStub.restore();
                });
        });

        it("should still succeed in posting a comment if action history failed", () => {
            const actionHistoryStub = stub(actionHistory, "writeActionHistory").callsArgWith(
                1,
                new Error("Could not write action history entry"),
                null
            );
            return assertUserLogin(agent, TEST_USER, TEST_PASSWORD)
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.isEmpty(res.body.data);
                })
                .then(() => {
                    return postComment(agent, testImage.id, TEST_COMMENT);
                })
                .then((res) => {
                    assert.equal(res.statusCode, 200);
                    const comment = res.body.comment;
                    assert.equal(comment.username, TEST_USER);
                    assert.equal(comment.comment, TEST_COMMENT);
                })
                .then(() => {
                    return getImageComments(agent, testImage.id);
                })
                .then((res) => {
                    assert.equal(res.body.data.length, 1);
                    assert.equal(res.body.data[0].username, TEST_USER);
                    assert.equal(res.body.data[0].comment, TEST_COMMENT);
                    assert.isTrue(actionHistoryStub.calledOnce);
                })
                .finally(() => {
                    actionHistoryStub.restore();
                });
        });

        before(() => {
            return mongoTestClient.initConnection();
        });

        beforeEach((done) => {
            addUser(TEST_USER, TEST_PASSWORD, "test@test.com")
                .then(() => {
                    return addImagesForUserFromFile(
                        [
                            {
                                fileName: "Black_tea_pot_cropped.jpg",
                                mimeType: "image/jpeg",
                            },
                        ],
                        TEST_USER
                    );
                })
                .then((imgs) => {
                    assert.equal(imgs.length, 1);
                    testImage = imgs[0];
                    agent = getServerAgent();
                    done();
                });
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
