/// <reference types="cypress" />

const { assert } = require("chai");

describe("simpleimage nav", () => {
    const username = "NewDemo";
    const password = "demo";

    before(() => {
        cy.deleteUser(username);
        cy.addUser(username, password, "test@example.com");
    });

    beforeEach(() => {
        cy.login(username, password);
        cy.visit("/");
    });

    it("shows user's name on the nav when they're logged in", () => {
        cy.get(".nav-item").contains(username).should("be.visible");
    });

    it("shows user's name on the mobile nav when they're logged in", () => {
        cy.viewport("iphone-x");
        cy.get("#mobile-menu-button").click();
        cy.get("#mobile-menu > .nav-item").contains(username).should("be.visible");
    });

    it("goes to user's profile when username is clicked on nav", () => {
        cy.get("#user-menu").click();
        cy.get("#user-menu .nav-menu-items").contains("Profile").should("be.visible").click();
        cy.location().its("pathname").should("eq", `/users/${username}`);
    });

    it("goes to user's profile when username is clicked on mobile nav", () => {
        cy.viewport("iphone-x");
        cy.get("#mobile-menu-button").click();
        cy.get("#mobile-menu .nav-item").contains("Profile").should("be.visible").click();
        cy.location().its("pathname").should("eq", `/users/${username}`);
    });

    it("should go to user settings when settings button is clicked on nav", () => {
        cy.get("#user-menu").click();
        cy.get("#user-menu .nav-menu-items").contains("Settings").should("be.visible").click();
        cy.location().its("pathname").should("eq", `/settings`);
    });

    it("should go to user settings when settings button is clicked on mobile nav", () => {
        cy.viewport("iphone-x");
        cy.get("#mobile-menu-button").click();
        cy.get("#mobile-menu .nav-item").contains("Settings").should("be.visible").click();
        cy.location().its("pathname").should("eq", `/settings`);
    });

    it("should logout user when logout button is clicked on nav", () => {
        cy.get(".nav-item").contains(username).should("be.visible");
        cy.get("#user-menu").click();
        cy.get("#user-menu .nav-menu-items").contains("Logout").should("be.visible").click();
        cy.get(".nav-item").contains(username).should("not.exist");
        cy.get(".nav-item").contains("Login").should("be.visible");
        cy.get(".nav-item").contains("Register").should("be.visible");
    });

    it("should logout user when logout button is clicked on mobile nav", () => {
        cy.viewport("iphone-x");
        cy.get("#mobile-menu-button").click();
        cy.get("#mobile-menu > .nav-item").contains(username).should("be.visible");
        cy.get("#mobile-menu .nav-item").contains("Logout").should("be.visible").click();
        cy.get("#mobile-menu-button").click();
        cy.get("#mobile-menu > .nav-item").contains(username).should("not.exist");
        cy.get("#mobile-menu > .nav-item").contains("Login").should("be.visible");
        cy.get("#mobile-menu > .nav-item").contains("Register").should("be.visible");
    });

    it("goes to the homepage when simpleimage logo is clicked", () => {
        cy.visit(`/users/${username}`);
        cy.location().its("pathname").should("eq", `/users/${username}`);
        cy.get("#title").click();
        cy.location().its("pathname").should("eq", `/`);
    });

    it("goes to the homepage when simpleimage logo is clicked on mobile", () => {
        cy.viewport("iphone-x");
        cy.visit(`/users/${username}`);
        cy.location().its("pathname").should("eq", `/users/${username}`);
        cy.get("#title").click();
        cy.location().its("pathname").should("eq", `/`);
    });
});
