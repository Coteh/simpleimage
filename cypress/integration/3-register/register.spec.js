/// <reference types="cypress" />

describe("simpleimage homepage - register", () => {
    const username = "BrandNewUser";
    const password = "BrandNewPassword1!";
    const email = "email@example.com";

    beforeEach(() => {
        cy.deleteUser(username);

        cy.visit("/");

        cy.intercept("GET", "/register").as("registerPage");

        cy.get(".register-view").should("not.exist");

        cy.get(".nav-item").eq(2).should("contain", "Register").click();

        cy.wait("@registerPage").its("response.statusCode").should("be.oneOf", [200]);

        cy.get(".register-view").should("exist");

        cy.intercept("POST", "/register").as("registerRequest");
    });

    it("allows user to register successfully", () => {
        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-register-username").should("be.visible").type(username);
        cy.get("input[name='password']").should("be.visible").type(password);
        cy.get("input[name='passwordConfirm']").should("be.visible").type(password);
        cy.get("input[name='email']").should("be.visible").type(email);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest").its("response.statusCode").should("eq", 200);

        cy.get(".nav-item").contains(username).should("be.visible");
    });
    it("displays username missing error if username is missing", () => {
        cy.get("input[name='password']").should("be.visible").type(password);
        cy.get("input[name='passwordConfirm']").should("be.visible").type(password);
        cy.get("input[name='email']").should("be.visible").type(email);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get("#input-register-username").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays password missing error if password is missing", () => {
        cy.get("#input-register-username").should("be.visible").type(username);
        cy.get("input[name='passwordConfirm']").should("be.visible").type(password);
        cy.get("input[name='email']").should("be.visible").type(email);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get("input[name='password']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays password confirm error if password confirm is missing", () => {
        cy.get("#input-register-username").should("be.visible").type(username);
        cy.get("input[name='password']").should("be.visible").type(password);
        cy.get("input[name='email']").should("be.visible").type(email);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get("input[name='passwordConfirm']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays email error if email is missing", () => {
        cy.get("#input-register-username").should("be.visible").type(username);
        cy.get("input[name='password']").should("be.visible").type(password);
        cy.get("input[name='passwordConfirm']").should("be.visible").type(password);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get("input[name='email']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays password mismatch error if passwords don't match", () => {
        cy.get("#input-register-username").should("be.visible").type(username);
        cy.get("input[name='password']").should("be.visible").type(password);
        cy.get("input[name='passwordConfirm']").should("be.visible").type(`${password}_wrong`);
        cy.get("input[name='email']").should("be.visible").type(email);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.assertErrorMessageContains("don't match");

        cy.get("input[name='password']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='passwordConfirm']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    // TODO explicitly turn on password strength check for this test
    it("displays password strength error if password is weak", () => {
        cy.get("#input-register-username").should("be.visible").type(username);
        cy.get("input[name='password']").should("be.visible").type("weak");
        cy.get("input[name='passwordConfirm']").should("be.visible").type("weak");
        cy.get("input[name='email']").should("be.visible").type(email);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.assertErrorMessageContainsMulti([
            "at least 10 characters long",
            "at least one uppercase letter",
            "at least one number",
            "at least one special character",
        ]);

        cy.get("input[name='password']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='passwordConfirm']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays email validation error if email is invalid", () => {
        cy.get("#input-register-username").should("be.visible").type(username);
        cy.get("input[name='password']").should("be.visible").type(password);
        cy.get("input[name='passwordConfirm']").should("be.visible").type(password);
        cy.get("input[name='email']").should("be.visible").type("invalidemail");
        cy.get(".submit-button").click();

        cy.wait("@registerRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        // TODO don't rely on the text of the error, come up with some other way to capture the error
        cy.assertErrorMessageContains("Invalid email");

        cy.get("input[name='email']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays username is available if username is available", () => {
        cy.clearBrowserCache();
        cy.intercept("GET", `/check_username?username=${username}`).as("checkUsername");
        cy.get("#input-register-username")
            .siblings()
            .then((siblings) => {
                const text = siblings[0].innerText;
                assert(!text.includes(username));
                assert(!text.includes("available"));
                assert(!text.includes("not available"));
            });
        cy.get("#input-register-username").should("be.visible").focus().type(username).blur();
        cy.wait("@checkUsername").then(({ response }) => {
            assert.oneOf(response.statusCode, [200]);
            assert.strictEqual(response.body.status, "success");
            assert.strictEqual(response.body.exists, false);
        });
        cy.get("#input-register-username")
            .siblings()
            .then((siblings) => {
                // TODO this test sometimes flakes at this point, figure out whether a cy.wait is needed or if there's a better solution
                const text = siblings[0].innerText;
                assert(text.includes(username));
                assert(text.includes("available"));
                assert(!text.includes("not available"));
            });

        cy.get("#input-register-username").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-success");
        });
    });
    it("displays username is not available if username is not available", () => {
        cy.clearBrowserCache();
        cy.intercept("GET", `/check_username?username=${username}`).as("checkUsername");
        cy.addUser(username, password, email);
        cy.get("#input-register-username")
            .siblings()
            .then((siblings) => {
                const text = siblings[0].innerText;
                assert(!text.includes(username));
                assert(!text.includes("available"));
                assert(!text.includes("not available"));
            });
        cy.get("#input-register-username").should("be.visible").focus().type(username).blur();
        cy.wait("@checkUsername").then(({ response }) => {
            assert.oneOf(response.statusCode, [200]);
            assert.strictEqual(response.body.status, "success");
            assert.strictEqual(response.body.exists, true);
        });
        cy.get("#input-register-username")
            .siblings()
            .then((siblings) => {
                const text = siblings[0].innerText;
                assert(text.includes(username));
                assert(text.includes("not available"));
            });

        cy.get("#input-register-username").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("should display error if user tries to register with taken username", () => {
        cy.addUser(username, password, email);

        cy.get("#input-register-username").should("be.visible").type(username);
        cy.get("input[name='password']").should("be.visible").type(password);
        cy.get("input[name='passwordConfirm']").should("be.visible").type(password);
        cy.get("input[name='email']").should("be.visible").type(email);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get(".nav-item").contains(username).should("not.exist");

        cy.assertErrorMessageContains("Username already exists");

        cy.get("#input-register-username").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays username is too long error if username is too long", () => {
        const longUsername = "reallyreallyreallyreallyreallyreallyreallyreallylongusername";
        cy.intercept("GET", `/check_username?username=${longUsername}`).as("checkUsername");

        cy.get("#input-register-username")
            .siblings()
            .then((siblings) => {
                const text = siblings[0].innerText;
                assert(!text.includes(longUsername));
                assert(!text.includes("available"));
                assert(!text.includes("not available"));
                assert(!text.includes("too long"));
            });
        cy.get("#input-register-username").should("be.visible").focus().type(longUsername).blur();
        cy.wait("@checkUsername").then(({ response }) => {
            assert.oneOf(response.statusCode, [400]);
            assert.strictEqual(response.body.status, "error");
            assert.strictEqual(response.body.errorID, "usernameTooLong");
        });
        cy.get("#input-register-username")
            .siblings()
            .then((siblings) => {
                // TODO this test sometimes flakes at this point, figure out whether a cy.wait is needed or if there's a better solution
                const text = siblings[0].innerText;
                assert(!text.includes(longUsername));
                assert(!text.includes("available"));
                assert(!text.includes("not available"));
                assert(text.includes("too long"));
            });

        cy.get("#input-register-username").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("should display error if user tries to register with username that is too long", () => {
        const longUsername = "reallyreallyreallyreallyreallyreallyreallyreallylongusername";

        cy.get("#input-register-username").should("be.visible").type(longUsername);
        cy.get("input[name='password']").should("be.visible").type(password);
        cy.get("input[name='passwordConfirm']").should("be.visible").type(password);
        cy.get("input[name='email']").should("be.visible").type(email);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest")
            .its("response.statusCode")
            .should("be.at.least", 400)
            .should("be.lessThan", 500);

        cy.get(".nav-item").contains(longUsername).should("not.exist");

        cy.assertErrorMessageContainsMulti(["Username", "too many characters"]);

        cy.get("#input-register-username").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
    });
    it("displays an error if there was an error with register user", () => {
        const errText = "An error has occurred. (mocked via cypress)";

        cy.intercept("POST", "/register", {
            statusCode: 500,
            body: {
                status: "error",
                message: errText,
            },
        }).as("registerRequest");

        cy.get(".nav-item").contains(username).should("not.exist");

        cy.get("#input-register-username").should("be.visible").type(username);
        cy.get("input[name='password']").should("be.visible").type(password);
        cy.get("input[name='passwordConfirm']").should("be.visible").type(password);
        cy.get("input[name='email']").should("be.visible").type(email);
        cy.get(".submit-button").click();

        cy.wait("@registerRequest").its("response.statusCode").should("eq", 500);

        cy.assertErrorMessageContains(errText);

        cy.get(".nav-item").contains(username).should("not.exist");
    });
});
