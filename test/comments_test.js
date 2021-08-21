const { HtmlValidate } = require('html-validate');
const { assert, expect } = require("chai");
const { generateCommentHTML, prepareCommentsJSON, generateCommentErrorHTML } = require("../lib/comments");

const htmlValidate = new HtmlValidate({
    root: true,
    extends: ["html-validate:recommended"],
    rules: {
        "close-order": "error",
        "no-inline-style": "off",
    },
});

describe("comments", () => {
    const COMMENT_TEXT = "Hello World";
    const USERNAME = "test-user";
    const IMAGE_ID = "abc123";
    const POSTED_DATE = new Date();
    const ERROR_CODE = "TEST_ERROR";

    const COMMENT_PAYLOAD = {
        postedDate: POSTED_DATE,
        username: USERNAME,
        comment: COMMENT_TEXT,
        imageID: IMAGE_ID,
    };

    const IMAGE_DATA_PAYLOAD = {
        images: {
            [IMAGE_ID]: {
                id: IMAGE_ID,
                mimetype: "image/png",
            }
        }
    };

    describe("image comments", () => {
        describe("image comments HTML", () => {
            it("should be able to return valid HTML", () => {
                const commentHTML = generateCommentHTML(COMMENT_PAYLOAD, "image");
                const validateReport = htmlValidate.validateString(commentHTML);
                assert.ok(validateReport.valid, `HTML is not valid: ${JSON.stringify(validateReport.results, null, 2)}`);
            });
            it("should contain username of commenter", () => {
                const commentHTML = generateCommentHTML(COMMENT_PAYLOAD, "image");
                assert.match(commentHTML, new RegExp(USERNAME, "g"));
            });
            it("should contain comment text", () => {
                const commentHTML = generateCommentHTML(COMMENT_PAYLOAD, "image");
                assert.match(commentHTML, new RegExp(COMMENT_TEXT, "g"));
            });
            it("should contain timestamp of comment", () => {
                const commentHTML = generateCommentHTML(COMMENT_PAYLOAD, "image");
                assert.match(commentHTML, new RegExp(POSTED_DATE.toUTCString(), "g"));
            });
        });
        describe("image comments JSON", () => {
            it("should contain username of commenter", () => {
                const comments = prepareCommentsJSON([COMMENT_PAYLOAD]);
                assert.lengthOf(comments, 1);
                assert.equal(comments[0].username, USERNAME);
            });
            it("should contain comment text", () => {
                const comments = prepareCommentsJSON([COMMENT_PAYLOAD]);
                assert.lengthOf(comments, 1);
                assert.equal(comments[0].comment, COMMENT_TEXT);
            });
            it("should contain timestamp of comment", () => {
                const comments = prepareCommentsJSON([COMMENT_PAYLOAD]);
                assert.lengthOf(comments, 1);
                assert.equal(comments[0].postedDate, POSTED_DATE);
            });
        });
    });
    describe("user comments", () => {
        describe("user comments HTML", () => {
            it("should be able to return valid HTML", () => {
                const commentHTML = generateCommentHTML(COMMENT_PAYLOAD, "user", IMAGE_DATA_PAYLOAD);
                const validateReport = htmlValidate.validateString(commentHTML);
                assert.ok(validateReport.valid, `HTML is not valid: ${JSON.stringify(validateReport.results, null, 2)}`);
            });
            it("should contain image ID of image being commented on", () => {
                const commentHTML = generateCommentHTML(COMMENT_PAYLOAD, "user", IMAGE_DATA_PAYLOAD);
                assert.match(commentHTML, new RegExp(IMAGE_ID, "g"));
            });
            it("should contain comment text", () => {
                const commentHTML = generateCommentHTML(COMMENT_PAYLOAD, "user", IMAGE_DATA_PAYLOAD);
                assert.match(commentHTML, new RegExp(COMMENT_TEXT, "g"));
            });
            it("should contain a link to 'removed' placeholder image if data is not present", () => {
                const commentHTML = generateCommentHTML(COMMENT_PAYLOAD, "user");
                assert.match(commentHTML, new RegExp("removed.png", "g"));
            });
            it("should contain timestamp of comment", () => {
                const commentHTML = generateCommentHTML(COMMENT_PAYLOAD, "user", IMAGE_DATA_PAYLOAD);
                assert.match(commentHTML, new RegExp(POSTED_DATE.toUTCString(), "g"));
            });
        });
        describe("user comments JSON", () => {
            it("should contain image ID of image being commented on", () => {
                const comments = prepareCommentsJSON([COMMENT_PAYLOAD]);
                assert.lengthOf(comments, 1);
                assert.equal(comments[0].imageID, IMAGE_ID);
            });
            it("should contain comment text", () => {
                const comments = prepareCommentsJSON([COMMENT_PAYLOAD]);
                assert.lengthOf(comments, 1);
                assert.equal(comments[0].comment, COMMENT_TEXT);
            });
            it("should contain timestamp of comment", () => {
                const comments = prepareCommentsJSON([COMMENT_PAYLOAD]);
                assert.lengthOf(comments, 1);
                assert.equal(comments[0].postedDate, POSTED_DATE);
            });
        });
    });
    describe("comments error", () => {
        it("should be valid HTML", () => {
            const validateReport = htmlValidate.validateString(generateCommentErrorHTML(ERROR_CODE));
            assert.ok(validateReport.valid, `HTML is not valid: ${JSON.stringify(validateReport.results, null, 2)}`);
        });
        it("should show supplied error code", () => {
            assert.match(generateCommentErrorHTML(ERROR_CODE), new RegExp(ERROR_CODE, "g"));
        });
    });
});
