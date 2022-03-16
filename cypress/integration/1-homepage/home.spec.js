/// <reference types="cypress" />

const { assert } = require("chai");

describe("simpleimage homepage", () => {
    const username = "NewDemo";
    const password = "demo";

    const assertImageUpload = (fileContent, fileName, mimeType) => {
        cy.get('input[type="file"]').attachFile({
            fileContent,
            fileName,
            mimeType,
        });

        // TODO remove this delay and listen for "input" event instead - tried adding it and it only seemed to fire after the test when selecting file manually
        // also will need to wrap the whole thing in a Cypress.Promise https://docs.cypress.io/api/utilities/promise#Usage
        cy.wait(1000);

        cy.intercept("POST", "/upload").as("uploadReq");

        cy.get("#upload-button").should("exist").click();

        cy.wait("@uploadReq").its("response.statusCode").should("be.oneOf", [200]);

        cy.location("pathname", {
            timeout: 60000,
        }).should("include", "/images/");

        cy.get(".image-view")
            .invoke("attr", "src")
            .should("include", ".jpeg")
            .then((src) => {
                cy.request(`/images/${src}`).its("status").should("eq", 200);
                const imageID = src.split(".jpeg")[0];
                cy.compareImageUsingUrl(imageID, `${Cypress.env("baseUrl")}/images/${src}`);
                cy.wrap(imageID);
            });
    };

    beforeEach(() => {
        cy.logout();
        cy.deleteUser(username);
        cy.deleteImagesFromUser(username);
        cy.addUser(username, password);
        cy.visit("/");
        // TODO fix issue with second test with upload attaching file too early
        cy.wait(1000);
    });

    it("uploads an image when upload button is clicked", () => {
        cy.fixture("image.jpg", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((fileContent) => {
                assertImageUpload(fileContent, "image.jpg", "image/jpeg");
            });
    });

    it("uploads an image as a guest", () => {
        cy.fixture("image.jpg", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((fileContent) => {
                assertImageUpload(fileContent, "image.jpg", "image/jpeg");
            })
            .then((imageID) => {
                cy.getImage(imageID).then((image) => assert.isNull(image.username));
            });
    });

    it("uploads an image as a registered user", () => {
        cy.login(username, password);
        cy.reload();
        cy.fixture("image.jpg", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((fileContent) => {
                assertImageUpload(fileContent, "image.jpg", "image/jpeg");
            })
            .then((imageID) => {
                cy.getImage(imageID).then((image) => assert.strictEqual(image.username, username));
            });
    });

    it("should not upload an image if user is logged in and their account was deleted before upload initiated", () => {
        cy.login(username, password);
        cy.reload();
        cy.deleteUser(username);
        cy.fixture("image.jpg", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((fileContent) => {
                cy.get('input[type="file"]').attachFile({
                    fileContent: fileContent,
                    fileName: "image.jpg",
                    mimeType: "image/jpeg",
                });

                cy.intercept("POST", "/upload").as("uploadReq");

                cy.get("#upload-button").should("exist").click();

                cy.wait("@uploadReq").its("response.statusCode").should("be.oneOf", [404]);

                // TODO assert using an error code or some other form of error ID instead
                cy.get("#notification-overlay-container")
                    .should("be.visible")
                    .should("satisfy", (el) => {
                        return Array.from(el[0].classList).includes("error");
                    })
                    .should(
                        "contain.text",
                        "There was an error uploading an image under this user. User could not be found. Ensure that user hasn't been deleted and try again."
                    );

                cy.url().should("eq", `${Cypress.env("baseUrl")}/`);

                cy.getImagesForUser(username).then((images) => {
                    assert.lengthOf(images, 0);
                });
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
            .then(async (fileContent) => {
                const fixtureBase64Str = await Cypress.Blob.blobToBase64String(fileContent);

                cy.get('input[type="file"]').should("exist").attachFile({
                    fileContent: fileContent,
                    fileName: "image.jpg",
                    mimeType: "image/jpeg",
                });

                cy.get(".image-preview", {
                    timeout: 10000,
                })
                    .should("be.visible")
                    .invoke("attr", "src")
                    .then((src) => {
                        assert.strictEqual(src.split(",")[1], fixtureBase64Str);
                    });
            });
    });

    // TODO prevent unsupported image types from being selected if user were to override the accepted types in input field
    it.skip("does not allow unsupported image type from being selected", () => {
        cy.fixture("invalid_attachment.pdf", "binary")
            .then(Cypress.Blob.binaryStringToBlob)
            .then((fileContent) => {
                cy.get('input[type="file"]').should("exist").attachFile({
                    fileContent: fileContent,
                    fileName: "invalid_attachment.pdf",
                    mimeType: "application/pdf",
                });

                cy.get('input[type="file"]').then((file) => {
                    assert.isEmpty(file[0].files);
                });
            });
    });
});
