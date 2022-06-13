const { defineConfig } = require("cypress");

module.exports = defineConfig({
    e2e: {
        setupNodeEvents(on, config) {
            return require("./cypress/plugins/e2e.js")(on, config);
        },
    },
});
