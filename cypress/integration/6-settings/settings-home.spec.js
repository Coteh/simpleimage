describe("settings main page", () => {
    const username = "NewDemo";
    const password = "demo";

    beforeEach(() => {
        cy.logout();
        cy.deleteUser(username);
        cy.addUser(username, password, "test@example.com");
    });
    it("should show settings if user is logged in", () => {
        cy.login(username, password);
        cy.visit("/settings");
        cy.contains("User Settings").should("be.visible");
    });
    it("should show an error if user not logged in", () => {
        cy.visit("/settings", {
            failOnStatusCode: false,
        });

        cy.contains("You must be logged in to access this page.").should("be.visible");

        cy.request({
            method: "GET",
            url: "/settings",
            failOnStatusCode: false,
        })
            .its("status")
            .should("eq", 401);
    });
    it("should show an error if user has been deleted", () => {
        cy.login(username, password);

        cy.deleteUser(username);

        cy.visit("/settings", {
            failOnStatusCode: false,
        });

        cy.contains("User cannot be found. Ensure user hasn't been deleted and try again.").should(
            "be.visible"
        );
    });
    it("should direct user to homepage if user logs out (using desktop nav)", () => {
        cy.login(username, password);
        cy.visit("/settings");

        cy.get(".nav-item").contains(username).should("be.visible");
        cy.get("#user-menu").click();
        cy.get("#user-menu .nav-menu-items").contains("Logout").should("be.visible").click();
        cy.get(".nav-item").contains(username).should("not.exist");
        cy.get(".nav-item").contains("Login").should("be.visible");
        cy.get(".nav-item").contains("Register").should("be.visible");

        cy.url().should("eql", `${Cypress.env("baseUrl")}/`);
    });

    it("should direct user to homepage if user logs out (using mobile nav)", () => {
        cy.viewport("iphone-x");

        cy.login(username, password);
        cy.visit("/settings");

        cy.get("#mobile-menu-button").click();
        cy.get("#mobile-menu > .nav-item").contains(username).should("be.visible");
        cy.get("#mobile-menu .nav-item").contains("Logout").should("be.visible").click();
        cy.get("#mobile-menu-button").click();
        cy.get("#mobile-menu > .nav-item").contains(username).should("not.exist");
        cy.get("#mobile-menu > .nav-item").contains("Login").should("be.visible");
        cy.get("#mobile-menu > .nav-item").contains("Register").should("be.visible");

        cy.url().should("eql", `${Cypress.env("baseUrl")}/`);
    });
});
