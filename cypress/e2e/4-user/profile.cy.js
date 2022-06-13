/// <reference types="cypress" />

const { assert } = require("chai");

describe("simeplimage user profile", () => {
    const username = "NewDemo";
    const password = "demo";

    const altUsername = "Demo2";

    before(() => {
        cy.clearBrowserCache();
        cy.deleteImagesFromUser(username);
        cy.deleteImagesFromUser(altUsername);
        cy.deleteCommentsFromUser(username);
        cy.deleteCommentsFromUser(altUsername);
        cy.deleteUser(username);
        cy.deleteUser(altUsername);
        cy.addUser(username, password, "test@example.com");
        cy.addUser(altUsername, password, "demo2@example.com");
        cy.fixture("image.jpg", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((imageData) => {
                cy.addImagesToUser(username, [
                    {
                        data: imageData,
                        uploadeddate_str: new Date().toString(),
                        mimetype: "image/jpeg",
                    },
                ]);
            });
        cy.fixture("image2.jpg", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((imageData) => {
                cy.addImagesToUser(altUsername, [
                    {
                        data: imageData,
                        uploadeddate_str: new Date().toString(),
                        mimetype: "image/jpeg",
                    },
                ]);
            });
        cy.getImagesForUser(username).then((imagesRes) => {
            assert.isAtLeast(imagesRes.length, 1);
            cy.getImagesForUser(altUsername).then((altImagesRes) => {
                assert.isAtLeast(altImagesRes.length, 1);
                cy.addCommentsToUser(username, [
                    {
                        image_id: imagesRes[0].id,
                        text: "Hi",
                        posted_date: new Date(),
                    },
                    {
                        image_id: altImagesRes[0].id,
                        text: "Yo",
                        posted_date: new Date(),
                    },
                ]);
            });
        });
    });

    beforeEach(() => {
        cy.login(username, password);

        cy.visit(`/users/${username}`);
    });

    it("displays username", () => {
        cy.get("#user-container").contains(username).should("be.visible");
    });

    it("displays user join date", () => {
        cy.getUser(username).then((user) => {
            cy.get(".user-view").contains(new Date(user.join_date).toString()).should("be.visible");
        });
    });

    describe("user's uploaded images", () => {
        let images;

        beforeEach(() => {
            cy.getImagesForUser(username).then((imagesRes) => {
                images = imagesRes;
            });
        });

        it("displays user's uploaded images", () => {
            cy.get("#user-images")
                .get(".user-image")
                .then((result) => {
                    for (let i = 0; i < result.length; i++) {
                        assert.equal(result[i].src.split("/")[4].split(".")[0], images[i].id);
                        cy.compareImageUsingUrl(images[i].id, result[i].src).should("eq", true);
                    }
                });
        });

        it("displays number of images uploaded by user", () => {
            cy.contains("Uploaded Images")
                .get("#images-count")
                .should("contain.text", `(${images.length})`);
        });

        // TODO implement this feature
        it.skip("allows for user to paginate through uploaded images", () => {
            assert.fail("Not implemented");
        });
    });

    describe("user's comments", () => {
        let comments;

        beforeEach(() => {
            cy.getCommentsForUser(username).then((commentsRes) => {
                comments = commentsRes;
            });
        });

        it("displays thumbnail for user's comment", () => {
            assert.isAtLeast(comments.length, 1);
            cy.get("#comments")
                .get(".comment > a > img")
                .then((res) => {
                    assert.equal(res[0].src.split("/")[4].split(".")[0], comments[0].image_id);
                    cy.compareImageUsingUrl(comments[0].image_id, res[0].src).should("eq", true);
                });
        });

        it("displays date of user comment", () => {
            cy.get("#comments-container")
                .get("#comments")
                .get(".comment:first")
                .contains(new Date(comments[0].posted_date).toString())
                .should("be.visible");
        });

        it("displays text of user comment", () => {
            cy.get("#comments-container")
                .get("#comments")
                .get(".comment:first")
                .contains(comments[0].comment)
                .should("be.visible");
        });

        it("displays number of comments written by user", () => {
            cy.contains("Comments")
                .get("#comment-count")
                .should("contain.text", `(${comments.length})`);
        });

        it("displays multiple comments written by user", () => {
            comments.forEach((comment) => {
                cy.get("#comments-container")
                    .get("#comments")
                    .get(".comment")
                    .contains(comment.comment)
                    .should("be.visible");
                cy.get("#comments-container")
                    .get("#comments")
                    .get(".comment")
                    .contains(new Date(comment.posted_date).toString())
                    .should("be.visible");
            });
        });

        // TODO implement this feature
        it.skip("allows for user to paginate through written comments", () => {
            assert.fail("Not implemented");
        });
    });

    it("handles user images load failure", () => {
        cy.intercept("GET", `/users/${username}/images`, {
            statusCode: 500,
            body: {
                status: "error",
                message: "Could not load user images due to server error",
            },
            delay: 2000,
        }).as("userImages");
        cy.reload();
        cy.get("#images-container .spinner").should("be.visible");
        cy.wait("@userImages").then(({ response }) => {
            assert.strictEqual(response.statusCode, 500);
            assert.strictEqual(response.body.status, "error");
            assert.isUndefined(response.body.data);
            cy.get("#images-container .spinner").should("not.be.visible");
            // TODO check on an error code or some other form of error ID instead
            cy.get("#images-container").contains("Could not get images due to an error.");
        });
    });

    it("handles user comments load failure", () => {
        cy.intercept("GET", `/users/${username}/comments`, {
            statusCode: 500,
            body: {
                status: "error",
                message: "Could not load user comments due to server error",
            },
            delay: 2000,
        }).as("userComments");
        cy.reload();
        cy.get("#comments-container .spinner").should("be.visible");
        cy.wait("@userComments").then(({ response }) => {
            assert.strictEqual(response.statusCode, 500);
            assert.strictEqual(response.body.status, "error");
            assert.isUndefined(response.body.data);
            cy.get("#comments-container .spinner").should("not.exist");
            // TODO check on an error code or some other form of error ID instead
            cy.get("#comments-container").contains("ERROR: Could not get comments.");
        });
    });

    it("shows spinner when images are loading", () => {
        cy.intercept("GET", `/users/${username}/images`, (req) => {
            req.continue((res) => {
                res.setDelay(1000);
                res.send();
            });
        }).as("userImages");
        cy.reload();
        cy.get("#images-container .spinner").should("be.visible");
        cy.wait("@userImages");
        cy.get("#images-container .spinner").should("not.be.visible");
    });

    it("shows spinner when comments are loading", () => {
        cy.intercept("GET", `/users/${username}/comments`, (req) => {
            req.continue((res) => {
                res.setDelay(1000);
                res.send();
            });
        }).as("userComments");
        cy.reload();
        cy.get("#comments-container .spinner").should("be.visible");
        cy.wait("@userComments");
        cy.get("#comments-container .spinner").should("not.exist");
    });

    it("should html escape comments", () => {
        let imageID;
        const commentDate = new Date();
        cy.deleteCommentsFromUser(username);
        cy.getImagesForUser(username).then((imagesRes) => {
            imageID = imagesRes[0].id;
            cy.addCommentsToUser(username, [
                {
                    image_id: imageID,
                    text: "<b>Hello World</b>",
                    posted_date: commentDate,
                },
            ]);

            cy.reload();

            cy.getCommentsForImage(imageID).then((comments) => {
                assert.strictEqual(comments.length, 1);
                cy.get("#comments > .comment:first-child").within(() => {
                    cy.get("a").should("have.attr", "href", `/images/${imageID}`);
                    cy.get(".time").should("contain.text", new Date(commentDate).toString());
                    cy.get("p").should("contain.text", "<b>Hello World</b>");
                });
            });
        });
    });

    it("should show user not found if on a nonexistent user's page", () => {
        const invalidUser = "invaliduser";

        cy.visit(`/users/${invalidUser}`, {
            failOnStatusCode: false,
        });

        cy.contains(`Could not find user "${invalidUser}".`).should("be.visible");
    });
});
