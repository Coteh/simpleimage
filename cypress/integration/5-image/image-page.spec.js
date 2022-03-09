/// <reference types="cypress" />

const { assert } = require("chai");

describe("simpleimage image page", () => {
    const username = "NewDemo";
    const password = "demo";

    let imageID;

    const commentText = "This is a test comment.";
    const commentDate = new Date();

    before(() => {
        cy.deleteImagesFromUser(username);
        cy.deleteUser(username);
        cy.addUser(username, password, "test@example.com");
        cy.fixture("image.jpg", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((fixtureImageData) => {
                cy.addImagesToUser(username, [
                    {
                        data: fixtureImageData,
                        uploadeddate_str: new Date().toString(),
                        mimetype: "image/jpeg",
                    },
                ]);
                cy.wait(1000);
                cy.getImagesForUser(username).then((imagesRes) => {
                    assert.isAtLeast(imagesRes.length, 1);
                    imageID = imagesRes[0].id;
                    cy.visit(`/images/${imageID}`);
                });
            });
    });
    beforeEach(() => {
        cy.deleteCommentsFromImage(imageID);
        cy.addCommentsToUser(username, [
            {
                image_id: imageID,
                text: commentText,
                posted_date: commentDate,
            },
        ]);
        cy.visit(`/images/${imageID}`);
    });
    it("should display image", () => {
        cy.get(".image-view").then(async (elem) => {
            assert.match(elem[0].src, new RegExp(`.*/images/${imageID}.jpeg$`));
            cy.compareImageUsingUrl(imageID, elem[0].src).should("eq", true);
        });
    });
    it.skip("should handle image load failure", () => {
        // TODO fix this flake - intercept not working when running this test using `cypress run`
        cy.intercept("GET", `/images/${imageID}.jpeg`, (req) => {
            req.reply({
                statusCode: 500,
                body: "Error loading image, server error",
                delay: 1000,
            });
        }).as("image");
        cy.clearBrowserCache();
        cy.reload();
        cy.wait("@image");
        cy.get(".image-view").then((elem) => assert.strictEqual(elem[0].complete, true));
    });
    it("should display comments for image", () => {
        cy.intercept(`/images/${imageID}/comments`).as("comments");
        cy.reload();
        cy.wait("@comments");
        cy.get("#comments-container .comment > p").should("contain.text", commentText);
        cy.get("#comments-container .comment > .time").should(
            "contain.text",
            commentDate.toString()
        );
        cy.get("#comments-container .comment > a").should("contain.text", username);
    });
    it("should handle comment load failure", () => {
        const errMsg = "Failed to load comments due to server error";
        cy.intercept(`/images/${imageID}/comments`, {
            statusCode: 500,
            body: {
                status: "error",
                message: errMsg,
            },
        }).as("comments");
        cy.reload();
        cy.wait("@comments");
        // TODO check by error id instead
        cy.get("#comments-container").should("contain.text", `Could not load comments: ${errMsg}`);
    });
    it("should handle comment parse failure", () => {
        cy.intercept(`/images/${imageID}/comments`, {
            statusCode: 200,
            body: "Not a JSON - parse failure should occur",
        }).as("comments");
        cy.reload();
        cy.wait("@comments");
        // TODO check by error id instead
        cy.get("#comments-container").should(
            "contain.text",
            `Could not load comments. Please try again later.`
        );
    });
    it("should allow user to post a comment", () => {
        const commentText = "This is a brand new comment";

        cy.login(username, password);
        cy.reload();

        cy.getCommentsForImage(imageID).its("length").should("eq", 1);

        cy.get("textarea[name='comment']").type(commentText);

        cy.intercept("POST", "/comment").as("comment");

        cy.contains("Submit").should("be.visible").click();

        cy.wait("@comment").its("response.statusCode").should("eq", 200);

        cy.get("textarea[name='comment']").should("have.value", "");

        cy.getCommentsForImage(imageID).then((comments) => {
            assert.strictEqual(comments.length, 2);
            const mostRecentComment = comments[comments.length - 1];
            cy.get("#comments > .comment:first-child").within(() => {
                cy.get("a").should("contain.text", username);
                cy.get(".time").should(
                    "contain.text",
                    new Date(mostRecentComment.posted_date).toString()
                );
                cy.get("p").should("contain.text", commentText);
            });
        });
    });
    it("should not post a comment if no text has been provided in comment box", () => {
        cy.login(username, password);
        cy.reload();

        cy.getCommentsForImage(imageID).its("length").should("eq", 1);

        cy.get("textarea[name='comment']").should("contain.value", "");

        cy.intercept("POST", "/comment").as("comment");

        cy.contains("Submit").should("be.visible").click();

        cy.wait(1000);

        cy.get("@comment").should("be.null");

        // TODO assert using an error code or some other form of error ID instead
        cy.get("#notification-overlay-container")
            .should("be.visible")
            .should("satisfy", (el) => {
                return Array.from(el[0].classList).includes("error");
            })
            .should("contain.text", "Please add text to your comment");

        cy.get("textarea[name='comment']").should("have.value", "");

        cy.getCommentsForImage(imageID).then((comments) => {
            assert.strictEqual(comments.length, 1);
            const mostRecentComment = comments[comments.length - 1];
            cy.get("#comments > .comment:first-child").within(() => {
                cy.get("a").should("contain.text", mostRecentComment.username);
                cy.get(".time").should(
                    "contain.text",
                    new Date(mostRecentComment.posted_date).toString()
                );
                cy.get("p").should("contain.text", mostRecentComment.comment);
            });
        });
    });
    it("should handle error when user posting comment", () => {
        const commentText = "This is a brand new comment";

        cy.login(username, password);
        cy.reload();

        cy.getCommentsForImage(imageID).its("length").should("eq", 1);

        cy.get("textarea[name='comment']").type(commentText);

        cy.intercept("POST", "/comment", {
            statusCode: 500,
            body: {
                status: "error",
                message: "Could not post comment due to an error.",
            },
        }).as("comment");

        cy.contains("Submit").should("be.visible").click();

        cy.wait("@comment").its("response.statusCode").should("eq", 500);

        // TODO assert using an error code or some other form of error ID instead
        cy.get("#notification-overlay-container")
            .should("be.visible")
            .should("satisfy", (el) => {
                return Array.from(el[0].classList).includes("error");
            })
            .should("contain.text", "Could not post comment due to an error");

        cy.get("textarea[name='comment']").should("have.value", commentText);

        cy.getCommentsForImage(imageID).then((comments) => {
            assert.strictEqual(comments.length, 1);
            const mostRecentComment = comments[comments.length - 1];
            cy.get("#comments > .comment:first-child").within(() => {
                cy.get("a").should("contain.text", mostRecentComment.username);
                cy.get(".time").should(
                    "contain.text",
                    new Date(mostRecentComment.posted_date).toString()
                );
                cy.get("p").should("contain.text", mostRecentComment.comment);
            });
        });
    });
    it("should handle user not being authenticated at the time of posting comment", () => {
        const commentText = "This is a brand new comment";

        cy.login(username, password);
        cy.reload();

        cy.getCommentsForImage(imageID).its("length").should("eq", 1);

        cy.get("textarea[name='comment']").type(commentText);

        cy.logout();

        cy.intercept("POST", "/comment").as("comment");

        cy.contains("Submit").should("be.visible").click();

        cy.wait("@comment").its("response.statusCode").should("eq", 401);

        // TODO assert using an error code or some other form of error ID instead
        cy.get("#notification-overlay-container")
            .should("be.visible")
            .should("satisfy", (el) => {
                return Array.from(el[0].classList).includes("error");
            })
            .should("contain.text", "Cannot perform action. Not signed in.");

        cy.get("textarea[name='comment']").should("have.value", commentText);

        cy.getCommentsForImage(imageID).then((comments) => {
            assert.strictEqual(comments.length, 1);
            const mostRecentComment = comments[comments.length - 1];
            cy.get("#comments > .comment:first-child").within(() => {
                cy.get("a").should("contain.text", mostRecentComment.username);
                cy.get(".time").should(
                    "contain.text",
                    new Date(mostRecentComment.posted_date).toString()
                );
                cy.get("p").should("contain.text", mostRecentComment.comment);
            });
        });
    });
    it("should html escape comments", () => {
        cy.deleteCommentsFromImage(imageID);
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
            const mostRecentComment = comments[comments.length - 1];
            cy.get("#comments > .comment:first-child").within(() => {
                cy.get("a").should("contain.text", username);
                cy.get(".time").should("contain.text", new Date(commentDate).toString());
                cy.get("p").should("contain.text", "<b>Hello World</b>");
            });
        });
    });
    it("should allow guest to access login page if login link is clicked", () => {
        cy.intercept("GET", "/login").as("loginPage");

        cy.get(".login-view").should("not.exist");

        cy.get(".action-link.login").eq(0).should("contain", "Log in").click();

        cy.wait("@loginPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".login-view").should("exist");
    });
    it("should allow guest to access register page is register link is clicked", () => {
        cy.intercept("GET", "/register").as("registerPage");

        cy.get(".register-view").should("not.exist");

        cy.get(".action-link.register").eq(0).should("contain", "register").click();

        cy.wait("@registerPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".register-view").should("exist");
    });
    it("should navigate to profile of image uploader if username link is clicked", () => {
        const profileUrl = `${Cypress.env("baseUrl")}/users/${username}`;

        cy.url().should("not.eq", profileUrl);

        cy.get("#image-container > .info > .user").should("have.text", username).click();

        cy.url().should("eq", profileUrl);
    });
    it("should say 'you' if the uploader is the same as the currently signed in user", () => {
        cy.login(username, password);

        cy.reload();

        const profileUrl = `${Cypress.env("baseUrl")}/users/${username}`;

        cy.url().should("not.eq", profileUrl);

        cy.get("#image-container > .info > .user").should("have.text", "you").click();

        cy.url().should("eq", profileUrl);
    });
    it("should say 'anonymous' if image was uploaded by guest", () => {
        cy.fixture("image.jpg", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((fixtureImageData) => {
                cy.addGuestImages([
                    {
                        data: fixtureImageData,
                        uploadeddate_str: new Date().toString(),
                        mimetype: "image/jpeg",
                    },
                ]);
            })
            .then((res) => {
                cy.visit(`/images/${res[0].id}`);
                cy.contains("Uploaded by anonymous").should("be.visible");
            });
    });
    it("should open image link if image were to be clicked", () => {
        const imageUrl = `${Cypress.env("baseUrl")}/images/${imageID}.jpeg`;

        // NOTE: Cannot click on image link due to cross-origin issues with Cypress,
        // instead just verify the resolved href would return the expected result
        cy.get("#image-container > a")
            .invoke("attr", "href")
            .then((href) => {
                const resolvedHref = `${Cypress.env("baseUrl")}/images/${href}`;
                assert.strictEqual(resolvedHref, imageUrl);
                cy.compareImageUsingUrl(imageID, resolvedHref).should("eq", true);
            });
    });
    describe("delete image", () => {
        let deletableImageID;
        const deletableUsername = "deleteMe";

        beforeEach(() => {
            cy.logout();
            cy.deleteImagesFromUser(deletableUsername);
            cy.deleteUser(deletableUsername);
            cy.addUser(deletableUsername, password, "test@example.com");
            cy.login(deletableUsername, password);
            cy.fixture("image.jpg", "binary")
                .then(Cypress.Blob.binaryStringToBlob)
                .then((fixtureImageData) => {
                    cy.addImagesToUser(deletableUsername, [
                        {
                            data: fixtureImageData,
                            uploadeddate_str: new Date().toString(),
                            mimetype: "image/jpeg",
                        },
                    ]);
                    cy.wait(1000);
                    cy.getImagesForUser(deletableUsername).then((imagesRes) => {
                        assert.isAtLeast(imagesRes.length, 1);
                        deletableImageID = imagesRes[0].id;
                        cy.intercept("DELETE", `/images/${deletableImageID}`).as("imageDelete");
                        cy.intercept("GET", "/").as("index");
                        cy.visit(`/images/${deletableImageID}`);
                    });
                });
        });
        it("should allow user to delete image if 'Delete' link is clicked", () => {
            cy.getImagesForUser(deletableUsername).should("have.length", 1);

            cy.get("#delete").should("be.visible").click();

            cy.get("#delete-confirm-yesno > span:first-child").click();

            cy.wait("@imageDelete").its("response.statusCode").should("eq", 200);

            cy.wait("@index");

            cy.getImagesForUser(deletableUsername).should("have.length", 0);

            cy.request({
                method: "GET",
                url: `/images/${deletableImageID}`,
                failOnStatusCode: false,
            })
                .its("status")
                .should("eq", 404);
        });
        it("should not allow image to be deleted if user is not logged in when they confirm action", () => {
            cy.getImagesForUser(deletableUsername).should("have.length", 1);

            cy.get("#delete").should("be.visible").click();

            cy.logout();

            cy.get("#delete-confirm-yesno > span:first-child").click();

            cy.wait("@imageDelete").its("response.statusCode").should("eq", 401);

            cy.get("@index").should("be.null");

            cy.getImagesForUser(deletableUsername).should("have.length", 1);

            cy.request({
                method: "GET",
                url: `/images/${deletableImageID}`,
                failOnStatusCode: false,
            })
                .its("status")
                .should("eq", 200);
        });
        it("should handle error when performing delete action", () => {
            cy.intercept("DELETE", `/images/${deletableImageID}`, {
                statusCode: 500,
                body: {
                    status: "error",
                    message: "Cannot delete image. Server error occurred.",
                },
            }).as("imageDelete");

            cy.getImagesForUser(deletableUsername).should("have.length", 1);

            cy.get("#delete").should("be.visible").click();

            cy.logout();

            cy.get("#delete-confirm-yesno > span:first-child").click();

            cy.wait("@imageDelete").its("response.statusCode").should("eq", 500);

            cy.get("@index").should("be.null");

            cy.getImagesForUser(deletableUsername).should("have.length", 1);

            cy.request({
                method: "GET",
                url: `/images/${deletableImageID}`,
                failOnStatusCode: false,
            })
                .its("status")
                .should("eq", 200);
        });
        it("should not delete image if user cancels the operation", () => {
            cy.getImagesForUser(deletableUsername).should("have.length", 1);

            cy.get("#delete").should("be.visible").click();

            cy.get("#delete-confirm-yesno > span:last-child").click();

            cy.get("@imageDelete").should("be.null");

            cy.get("@index").should("be.null");

            cy.getImagesForUser(deletableUsername).should("have.length", 1);

            cy.request({
                method: "GET",
                url: `/images/${deletableImageID}`,
                failOnStatusCode: false,
            })
                .its("status")
                .should("eq", 200);
        });
        it("should not delete image if user was deleted before they confirm the operation", () => {
            cy.getImagesForUser(deletableUsername).should("have.length", 1);

            cy.get("#delete").should("be.visible").click();

            cy.deleteUser(deletableUsername);

            cy.get("#delete-confirm-yesno > span:first-child").click();

            cy.wait("@imageDelete").its("response.statusCode").should("eq", 404);

            // TODO assert using an error code or some other form of error ID instead
            cy.contains(
                "There was an error deleting image. User could not be found. Ensure that user hasn't been deleted and try again."
            ).should("be.visible");

            cy.get("@index").should("be.null");

            cy.getImagesForUser(deletableUsername).should("have.length", 1);

            cy.request({
                method: "GET",
                url: `/images/${deletableImageID}`,
                failOnStatusCode: false,
            })
                .its("status")
                .should("eq", 200);
        });
    });
    it("should show an error if page for nonexistent image is accessed", () => {
        cy.visit(`/images/invalidimage`, {
            failOnStatusCode: false,
        });

        cy.contains("Image of this ID does not exist on the database.").should("be.visible");
    });
});
