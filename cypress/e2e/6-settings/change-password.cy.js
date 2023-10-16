describe("change password", () => {
    const username = "NewDemo";
    const password = "demo";
    const newPassword = "BrandNewPassword1!";

    beforeEach(() => {
        cy.deleteUser(username);
        cy.addUser(username, password, "test@example.com");

        cy.login(username, password);

        cy.visit(`/settings`);
    });
    it("should change user's password", () => {
        cy.intercept("POST", "/settings/change_password").as("changePassword");

        cy.get("input[name='oldPassword']").type(password);
        cy.get("input[name='newPassword']").type(newPassword);
        cy.get("input[name='newPasswordConfirm']").type(newPassword);

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 200);

        // TODO assert using an success code or some other form of success ID instead
        cy.assertSuccessMessageContains("Password changed");

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.logout();
        cy.login(username, newPassword).its("status").should("eq", 200);
    });
    it("should not change user's password if current password not provided", () => {
        cy.intercept("POST", "/settings/change_password").as("changePassword");

        cy.get("input[name='newPassword']").type(newPassword);
        cy.get("input[name='newPasswordConfirm']").type(newPassword);

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 422);

        // TODO assert using an error code or some other form of error ID instead
        cy.assertErrorMessageContains("Could not change password. Missing old password.");

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.logout();
        cy.login(username, password).its("status").should("eq", 200);
    });
    it("should not change user's password if current password is wrong", () => {
        cy.intercept("POST", "/settings/change_password").as("changePassword");

        cy.get("input[name='oldPassword']").type("wrong");
        cy.get("input[name='newPassword']").type(newPassword);
        cy.get("input[name='newPasswordConfirm']").type(newPassword);

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 400);

        // TODO assert using an error code or some other form of error ID instead
        cy.assertErrorMessageContains("Could not change password. Old password is not correct.");

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.logout();
        cy.login(username, password).its("status").should("eq", 200);
    });
    it("should not change user's password if new password is not provided", () => {
        cy.intercept("POST", "/settings/change_password").as("changePassword");

        cy.get("input[name='oldPassword']").type(password);
        cy.get("input[name='newPasswordConfirm']").type(newPassword);

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 422);

        // TODO assert using an error code or some other form of error ID instead
        cy.assertErrorMessageContains("Could not change password. Missing new password.");

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.logout();
        cy.login(username, password).its("status").should("eq", 200);
    });
    it("should not change user's password if new password confirmation is not provided", () => {
        cy.intercept("POST", "/settings/change_password").as("changePassword");

        cy.get("input[name='oldPassword']").type(password);
        cy.get("input[name='newPassword']").type(newPassword);

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 422);

        // TODO assert using an error code or some other form of error ID instead
        cy.assertErrorMessageContains("Could not change password. Missing new password confirmation.");

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });

        cy.logout();
        cy.login(username, password).its("status").should("eq", 200);
    });
    it("should not change user's password if new password and its confirmation do not match", () => {
        cy.intercept("POST", "/settings/change_password").as("changePassword");

        cy.get("input[name='oldPassword']").type(password);
        cy.get("input[name='newPassword']").type(newPassword);
        cy.get("input[name='newPasswordConfirm']").type("wrong");

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 400);

        // TODO assert using an error code or some other form of error ID instead
        cy.assertErrorMessageContains("Could not change password. Passwords don't match.");

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });

        cy.logout();
        cy.login(username, password).its("status").should("eq", 200);
    });
    it("should not change user password if new password is not strong enough", () => {
        cy.intercept("POST", "/settings/change_password").as("changePassword");

        const newWeakPassword = "weak";

        cy.get("input[name='oldPassword']").type(password);
        cy.get("input[name='newPassword']").type(newWeakPassword);
        cy.get("input[name='newPasswordConfirm']").type(newWeakPassword);

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get(".submit-button").click();

        cy.wait("@changePassword").then((interception) => {
            const response = interception.response;

            expect(response.statusCode).to.eql(400);
            expect(response.body.errorID).to.eql("passwordNotStrong");
        });

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });

        cy.logout();
        cy.login(username, password).its("status").should("eq", 200);
    });
    it("should not change user's password if there was a server error", () => {
        cy.intercept("POST", "/settings/change_password", {
            statusCode: 500,
            body: {
                status: "error",
                message: "Change password failed due to server error",
            },
        }).as("changePassword");

        cy.get("input[name='oldPassword']").type(password);
        cy.get("input[name='newPassword']").type(newPassword);
        cy.get("input[name='newPasswordConfirm']").type(newPassword);
        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 500);

        // TODO assert using an error code or some other form of error ID instead
        cy.assertErrorMessageContains("Change password failed due to server error");

        cy.logout();
        cy.login(username, password).its("status").should("eq", 200);
    });
    it("should not change password if user has been deleted", () => {
        cy.intercept("POST", "/settings/change_password").as("changePassword");

        cy.get("input[name='oldPassword']").type(password);
        cy.get("input[name='newPassword']").type(newPassword);
        cy.get("input[name='newPasswordConfirm']").type(newPassword);

        cy.deleteUser(username);

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 404);

        cy.get("@changePassword").its("response.body.errorID").should("eq", "sessionUserNotFound");

        cy.logout();
        cy.login(username, password).its("status").should("eq", 401);
        cy.login(username, newPassword).its("status").should("eq", 401);
    });
    it("should clear notifications and input fields when attempting to change password multiple times", () => {
        cy.intercept("POST", "/settings/change_password").as("changePassword");

        cy.get("input[name='oldPassword']").type(password);
        cy.get("input[name='newPassword']").type(newPassword);
        cy.get("input[name='newPasswordConfirm']").type("wrong");

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 400);

        cy.assertErrorMessageContains("Could not change password. Passwords don't match.");

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 400);

        cy.assertErrorMessageContains("Could not change password. Passwords don't match.");
        cy.assertErrorMessageNotContains(
            "Could not change password. Passwords don't match.Could not change password. Passwords don't match."
        );

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return Array.from(el[0].classList).includes("input-field-error");
        });

        cy.get("input[name='newPasswordConfirm']").clear().type(newPassword);

        cy.get(".submit-button").click();

        cy.wait("@changePassword").its("response.statusCode").should("eq", 200);

        cy.assertSuccessMessageContains("Password changed.");
        cy.assertSuccessMessageNotContains(
            "Could not change password. Passwords don't match.Could not change password. Passwords don't match.Password changed."
        );

        cy.get("input[name='oldPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPassword']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
        cy.get("input[name='newPasswordConfirm']").should("satisfy", (el) => {
            return !Array.from(el[0].classList).includes("input-field-error");
        });
    });
});
