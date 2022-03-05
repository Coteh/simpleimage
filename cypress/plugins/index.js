/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

const mongoHelper = require("./mongo");
const fetch = require("cross-fetch");

// https://stackoverflow.com/a/12101012
const arrayBufferToBuffer = (arrBuffer) => {
    const buffer = Buffer.alloc(arrBuffer.byteLength);
    const view = new Uint8Array(arrBuffer);
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = view[i];
    }
    return buffer;
};

/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
    // `on` is used to hook into various events Cypress emits
    on("task", {
        async deleteUser(username) {
            await mongoHelper.deleteUser(username);
            return null;
        },
        async addUser({ username, password, email }) {
            await mongoHelper.addUser(username, password, email);
            return null;
        },
        async getUser(username) {
            return await mongoHelper.getUser(username);
        },
        async getImagesForUser(username) {
            return await mongoHelper.getImagesForUser(username);
        },
        async getCommentsForUser(username) {
            return await mongoHelper.getCommentsForUser(username);
        },
        async getCommentsForImage(imageID) {
            return await mongoHelper.getCommentsForImage(imageID);
        },
        async getImage(imageID) {
            return await mongoHelper.getImage(imageID);
        },
        async deleteImage(imageID) {
            await mongoHelper.deleteImage(imageID);
            return null;
        },
        async deleteImagesFromUser(username) {
            await mongoHelper.deleteImagesFromUser(username);
            return null;
        },
        async deleteCommentsFromUser(username) {
            await mongoHelper.deleteCommentsFromUser(username);
            return null;
        },
        async deleteCommentsFromImage(imageID) {
            await mongoHelper.deleteCommentsFromImage(imageID);
            return null;
        },
        async addImagesToUser({ username, images }) {
            await mongoHelper.addImagesToUser(username, images);
            return null;
        },
        async addCommentsToUser({ username, comments }) {
            await mongoHelper.addCommentsToUser(username, comments);
            return null;
        },
        async addGuestImages(images) {
            return await mongoHelper.addGuestImages(images);
        },
        async compareImageUsingUrl({ imageID, url }) {
            // first grabs image from db by imageID and saves as buffer
            const imageFromMongo = await mongoHelper.getImage(imageID);
            const mongoBuffer = imageFromMongo.data.buffer;
            // then grabs image from supplied url and save it as buffer
            const imageFromUrl = await fetch(url);
            const urlBuffer = arrayBufferToBuffer(await imageFromUrl.arrayBuffer());
            // compare buffers for pixel perfect match
            return urlBuffer.equals(mongoBuffer);
        },
    });
    // `config` is the resolved Cypress config
    // Get baseUrl from environment variable https://github.com/cypress-io/cypress/issues/909#issuecomment-578505704
    const baseUrl = config.env.baseUrl || null;

    if (baseUrl) {
        config.baseUrl = baseUrl;
    }

    return config;
};
