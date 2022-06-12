/// <reference types="cypress" />

const { assert } = require("chai");

describe("simpleimage homepage", () => {
    const username = "NewDemo";
    const password = "demo";

    const performImageUpload = (fileName, mimeType) => {
        // Wait a second for all page elements to load and for the document ready handler to clear out selected filename from cache
        // TODO listen for document ready handler to fire instead
        cy.wait(1000);

        cy.get('input[type="file"]').selectFile(
            {
                contents: `cypress/fixtures/${fileName}`,
                fileName,
                mimeType,
            },
            {
                force: true,
            }
        );

        cy.intercept("POST", "/upload").as("uploadReq");

        return cy.get("#upload-button").should("exist").click();
    };

    const assertImageUploadSucceeded = (fileName, ext) => {
        cy.wait("@uploadReq").its("response.statusCode").should("be.oneOf", [200]);

        cy.location("pathname", {
            timeout: 60000,
        }).should("include", "/images/");

        cy.get(".image-view")
            .invoke("attr", "src")
            .should("include", ext)
            .then((src) => {
                cy.request(`/images/${src}`).its("status").should("eq", 200);
                const imageID = src.split(ext)[0];
                cy.comparePNGImagesUsingFilepath(imageID, `cypress/fixtures/${fileName}`).should("eq", true);
                cy.wrap(imageID);
            });
    };

    const assertImageUploadFailed = (statusCode, expectedMsg) => {
        cy.wait("@uploadReq").its("response.statusCode").should("be.oneOf", [statusCode]);

        // TODO assert using an error code or some other form of error ID instead
        cy.assertErrorMessageContains(expectedMsg);

        cy.url().should("eq", `${Cypress.env("baseUrl")}/`);
    };

    beforeEach(() => {
        cy.logout();
        cy.deleteUser(username);
        cy.deleteImagesFromUser(username);
        cy.addUser(username, password, "test@example.com");
        cy.visit("/");
    });

    it("uploads an image when upload button is clicked", () => {
        performImageUpload("Ingranaggio.png", "image/png").then(() =>
            assertImageUploadSucceeded("Ingranaggio.png", ".png")
        );
    });

    it("uploads an image as a guest", () => {
        performImageUpload("Ingranaggio.png", "image/png")
            .then(() => assertImageUploadSucceeded("Ingranaggio.png", ".png"))
            .then((imageID) => {
                cy.getImage(imageID).then((image) => assert.isNull(image.username));
            });
    });

    it("uploads an image as a registered user", () => {
        cy.getImagesForUser(username).its("length").should("eq", 0);
        cy.login(username, password);
        cy.reload();
        performImageUpload("Ingranaggio.png", "image/png")
            .then(() => assertImageUploadSucceeded("Ingranaggio.png", ".png"))
            .then((imageID) => {
                cy.getImagesForUser(username).its("length").should("eq", 1);
                cy.getImage(imageID).then((image) => assert.strictEqual(image.username, username));
            });
    });

    it("should not upload an image if user is logged in and their account was deleted before upload initiated", () => {
        cy.getImagesForUser(username).its("length").should("eq", 0);
        cy.login(username, password);
        cy.reload();
        cy.deleteUser(username);
        performImageUpload("Ingranaggio.png", "image/png")
            // TODO assert on error ID instead of error message
            .then(() =>
                assertImageUploadFailed(
                    404,
                    "There was an error uploading an image under this user. User could not be found. Ensure that user hasn't been deleted and try again."
                )
            )
            .then(() => {
                cy.getImagesForUser(username).its("length").should("eq", 0);
            });
    });

    it("should handle server error when uploading image", () => {
        cy.intercept("/upload", {
            statusCode: 500,
            body: {
                status: "error",
                message: "Could not upload image due to server error",
            },
        });
        cy.getImagesForUser(username).its("length").should("eq", 0);
        cy.login(username, password);
        cy.reload();
        performImageUpload("Ingranaggio.png", "image/png")
            // TODO assert on error ID instead of error message
            .then(() => assertImageUploadFailed(500, "Could not upload image due to server error"))
            .then(() => {
                cy.getImagesForUser(username).its("length").should("eq", 0);
            });
    });

    it("displays login page when Login button is clicked", () => {
        cy.intercept("GET", "/login").as("loginPage");

        cy.get(".login-view").should("not.exist");

        cy.get(".nav-item").eq(1).should("contain", "Login").click();

        cy.wait("@loginPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".login-view").should("exist");
    });

    it("displays register page when Register button is clicked", () => {
        cy.intercept("GET", "/register").as("registerPage");

        cy.get(".register-view").should("not.exist");

        cy.get(".nav-item").eq(2).should("contain", "Register").click();

        cy.wait("@registerPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".register-view").should("exist");
    });

    it.skip("opens login page when file select button is clicked and user is not logged in and LOGIN_TO_UPLOAD is enabled", () => {
        cy.get("#select-button").click();

        assert.fail("TODO set LOGIN_TO_UPLOAD for this test only - then implement the test");
    });

    it.skip("should prevent upload of image if login to upload is circumvented despite LOGIN_TO_UPLOAD being enabled", () => {
        assert.fail("TODO set LOGIN_TO_UPLOAD for this test only - then implement the test");
    });

    it("displays nav menu when hamburger button is clicked on mobile", () => {
        cy.viewport("iphone-x");

        cy.get("#mobile-menu-button").should("be.visible").click();

        cy.get("#mobile-menu").should("be.visible");
    });

    it("displays login page when Login button is clicked in mobile nav", () => {
        cy.intercept("GET", "/login").as("loginPage");

        cy.viewport("iphone-x");

        cy.get("#mobile-menu-button").should("be.visible").click();

        cy.get("#mobile-menu").should("be.visible");

        cy.get(".login-view").should("not.exist");

        cy.get("#mobile-menu > .nav-button").contains("Login").click();

        cy.wait("@loginPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".login-view").should("exist");
    });

    it("displays register page when Register button is clicked in mobile nav", () => {
        cy.intercept("GET", "/register").as("registerPage");

        cy.viewport("iphone-x");

        cy.get("#mobile-menu-button").should("be.visible").click();

        cy.get("#mobile-menu").should("be.visible");

        cy.get(".register-view").should("not.exist");

        cy.get("#mobile-menu > .nav-button").contains("Register").click();

        cy.wait("@registerPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".register-view").should("exist");
    });

    it("shows preview image when file is selected", () => {
        cy.fixture("image.jpg", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((fileContent) => {
                cy.get('input[type="file"]').should("exist").selectFile(
                    {
                        contents: "cypress/fixtures/image.jpg",
                        fileName: "image.jpg",
                        mimeType: "image/jpeg",
                    },
                    {
                        force: true,
                    }
                );

                cy.get(".image-preview", {
                    timeout: 10000,
                })
                    .should("be.visible")
                    .invoke("attr", "src")
                    .then(async (src) => {
                        assert.strictEqual(src.split(",")[1], await Cypress.Blob.blobToBase64String(fileContent));
                    });
            });
    });

    // TODO prevent unsupported image types from being selected if user were to override the accepted types in input field
    it.skip("does not allow unsupported image type from being selected", () => {
        cy.get('input[type="file"]').should("exist").selectFile(
            {
                contents: "cypress/fixtures/invalid_attachment.pdf",
                fileName: "invalid_attachment.pdf",
                mimeType: "application/pdf",
            },
            {
                force: true,
            }
        );

        cy.get('input[type="file"]').then((file) => {
            assert.isEmpty(file[0].files);
        });
    });
});
