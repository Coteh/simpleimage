// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

Cypress.Commands.add("assertErrorMessageContains", (message) => {
    cy.get("#notification-overlay-container")
        .should("be.visible")
        .should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("error");
        })
        .should("contain.text", message);
});

Cypress.Commands.add("assertErrorMessageContainsMulti", (messages) => {
    const chain = cy
        .get("#notification-overlay-container")
        .should("be.visible")
        .should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("error");
        });
    messages.forEach((message) => {
        chain.should("contain.text", message);
    });
});

Cypress.Commands.add("assertSuccessMessageContains", (message) => {
    cy.get("#notification-overlay-container")
        .should("be.visible")
        .should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("error");
        })
        .should("contain.text", message);
});

Cypress.Commands.add("assertSuccessMessageContainsMulti", (messages) => {
    const chain = cy
        .get("#notification-overlay-container")
        .should("be.visible")
        .should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("error");
        });
    messages.forEach((message) => {
        chain.should("contain.text", message);
    });
});

Cypress.Commands.add("deleteUser", (username) => {
    cy.task("deleteUser", username);
});

Cypress.Commands.add("addUser", (username, password, email) => {
    cy.task("addUser", { username, password, email });
});

Cypress.Commands.add("getUser", (username) => {
    cy.task("getUser", username);
});

Cypress.Commands.add("getImagesForUser", (username) => {
    cy.task("getImagesForUser", username);
});

Cypress.Commands.add("getCommentsForUser", (username) => {
    cy.task("getCommentsForUser", username);
});

Cypress.Commands.add("getCommentsForImage", (imageID) => {
    cy.task("getCommentsForImage", imageID);
});

Cypress.Commands.add("getImage", (imageID) => {
    cy.task("getImage", imageID);
});

Cypress.Commands.add("deleteImage", (imageID) => {
    cy.task("deleteImage", imageID);
});

Cypress.Commands.add("deleteImagesFromUser", (username) => {
    cy.task("deleteImagesFromUser", username);
});

Cypress.Commands.add("deleteCommentsFromUser", (username) => {
    cy.task("deleteCommentsFromUser", username);
});

Cypress.Commands.add("deleteCommentsFromImage", (imageID) => {
    cy.task("deleteCommentsFromImage", imageID);
});

Cypress.Commands.add("addImagesToUser", (username, images) => {
    cy.task("addImagesToUser", { username, images });
});

Cypress.Commands.add("addCommentsToUser", (username, comments) => {
    cy.task("addCommentsToUser", { username, comments });
});

Cypress.Commands.add("addGuestImages", (images) => {
    cy.task("addGuestImages", images);
});

Cypress.Commands.add("compareImageUsingUrl", (imageID, url) => {
    cy.task("compareImageUsingUrl", { imageID, url });
});

Cypress.Commands.add("comparePNGImagesUsingFilepath", (imageID, filepath) => {
    cy.task("comparePNGImagesUsingFilepath", { imageID, filepath });
});

Cypress.Commands.add("login", (username, password) => {
    cy.request({
        method: "POST",
        url: "/login",
        body: {
            username,
            password,
        },
        failOnStatusCode: false,
    });
});

Cypress.Commands.add("logout", () => {
    cy.request({
        method: "POST",
        url: "/logout",
        failOnStatusCode: false,
    });
});

Cypress.Commands.add("clearBrowserCache", () => {
    // Call Chrome's API for clearing browser cache when running this test,
    // certain requests such as username existence will not provide any data to Cypress when returned as a cached response
    // due to how cy.intercept manages the browser request
    // https://stackoverflow.com/a/67858001
    Cypress.automation("remote:debugger:protocol", {
        command: "Network.clearBrowserCache",
    });
});
