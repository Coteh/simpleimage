const assert = require("assert");
const logger = require("../lib/log");
const SeverityLevel = logger.SeverityLevel;

describe("log", function() {
    describe("internal", function() {
        describe("getSeverityString", function() {
            it("should return appropriate severity strings given severity value", function() {
                assert.strictEqual(logger.getSeverityString(SeverityLevel.NONE), "");
                assert.strictEqual(logger.getSeverityString(SeverityLevel.INFO), "INFO");
                assert.strictEqual(logger.getSeverityString(SeverityLevel.TRACE), "TRACE");
                assert.strictEqual(logger.getSeverityString(SeverityLevel.WARN), "WARN");
                assert.strictEqual(logger.getSeverityString(SeverityLevel.ERROR), "ERROR");
            });
            it("should return empty string if undefined passed in", function() {
                assert.strictEqual(logger.getSeverityString(undefined), "");
            });
        });
    });

    describe("external", function() {

    });
});