/// <reference types="cypress" />

describe("simpleimage homepage - login", () => {
    const username = "NewDemo";
    const password = "demo";

    before(() => {
        cy.deleteUser(username);
        cy.addUser(username, password, "test@example.com");
    });

    beforeEach(() => {
        cy.visit("/");

        cy.intercept("GET", "/login").as("loginPage");

        cy.get(".login-view").should("not.exist");

        cy.get(".nav-item").eq(1).should("contain", "Login").click();

        cy.wait("@loginPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".login-view").should("exist");

        cy.intercept("POST", "/login").as("loginRequest");
    });

    it("allows user to login successfully", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-login-username").should("be.visible").type("NewDemo");
        cy.get("input[type='password']").should("be.visible").type("demo");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest").its("response.statusCode").should("eq", 200);

        cy.get(".nav-item").contains(username).should("be.visible");
    });
    it("displays missing username error if username is missing", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("input[type='password']").should("be.visible").type("demo");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.assertErrorMessageContains("username");

        cy.get(".nav-item").contains(username).should("not.exist");
    });
    it("should display an error style around username field if username is missing when submitting", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("input[type='password']").should("be.visible").type("demo");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get("#input-login-username").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays missing password error if password is missing", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-login-username").should("be.visible").type("NewDemo");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.assertErrorMessageContains("password");

        cy.get(".nav-item").contains(username).should("not.exist");
    });
    it("should display an error style around password field if password is missing when submitting", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-login-username").should("be.visible").type("NewDemo");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get("input[type='password']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays username/password error if username is incorrect", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-login-username").should("be.visible").type("wrong");
        cy.get("input[type='password']").should("be.visible").type("demo");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.assertErrorMessageContainsMulti(["Username", "password", "combination", "not found"]);

        cy.get(".nav-item").contains(username).should("not.exist");
    });
    it("should display an error style around both username and password fields if username is incorrect", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-login-username").should("be.visible").type("wrong");
        cy.get("input[type='password']").should("be.visible").type("demo");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get("#input-login-username").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[type='password']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays username/password error if password is incorrect", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-login-username").should("be.visible").type("NewDemo");
        cy.get("input[type='password']").should("be.visible").type("wrong");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.assertErrorMessageContainsMulti(["Username", "password", "combination", "not found"]);

        cy.get(".nav-item").contains(username).should("not.exist");
    });
    it("should display an error style around both username and password fields if password is incorrect", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-login-username").should("be.visible").type("NewDemo");
        cy.get("input[type='password']").should("be.visible").type("wrong");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get("#input-login-username").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[type='password']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays register view when Register button is clicked", () => {
        cy.intercept("GET", "/register").as("registerPage");

        cy.get(".register-view").should("not.exist");

        cy.get("#register-via-login-button").click();

        cy.wait("@registerPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".register-view").should("exist");
    });
    it("hides login view when Register button is clicked", () => {
        cy.intercept("GET", "/register").as("registerPage");

        cy.get(".login-view").should("exist");

        cy.get("#register-via-login-button").click();

        cy.wait("@registerPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".login-view").should("not.exist");
    });
    it("hides login view when X in Close button is clicked", () => {
        cy.get(".login-view").should("exist");

        cy.get(".close-button").click();

        cy.get(".login-view").should("not.exist");
    });
    it('hides login view when "Close" text in Close button is clicked', () => {
        cy.get(".login-view").should("exist");

        cy.contains("Close").click();

        cy.get(".login-view").should("not.exist");
    });
    it("displays an error if there was an error with login", () => {
        const errText = "An error has occurred. (mocked via cypress)";

        cy.intercept("POST", "/login", {
            statusCode: 500,
            body: {
                status: "error",
                message: errText,
            },
        }).as("loginRequest");

        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-login-username").should("be.visible").type("NewDemo");
        cy.get("input[type='password']").should("be.visible").type("demo");
        cy.get(".submit-button").should("be.visible").click();

        cy.wait("@loginRequest").its("response.statusCode").should("eq", 500);

        cy.assertErrorMessageContains(errText);

        cy.get(".nav-item").contains(username).should("not.exist");
    });
});
