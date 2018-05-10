var assert = require("assert");
var proxyquire = require("proxyquire");

var databaseOpsStub = {
    writeActionHistoryEntry: function(actionEntry, callback) {
        var testObj = {
            type: actionEntry.type,
            item: actionEntry.item,
            username: actionEntry.username,
            ip_address: actionEntry.ipAddress,
            info: actionEntry.info,
            action_date: new Date(0)
        };

        callback(null, testObj);
    }
};

var actionHistory = proxyquire("../lib/action-history", { "./database-ops": databaseOpsStub });

describe("action history", function() {
    describe("writeActionHistoryEntry", function() {
        it("should write an action history entry with all the required information", function(done) {
            var testData = {
                type: "UPLOAD_IMAGE",
                item: "ImageID",
                username: "si_user",
                ipAddress: "127.0.0.1",
                info: {
                    request_url: "upload",
                    author: "si_user"
                }
            };
            actionHistory.writeActionHistory(testData, function (err, result) {
                assert.ifError(err);
                assert.ok(result);
                assert.equal(result.type, testData.type);
                assert.equal(result.item, testData.item);
                assert.equal(result.username, testData.username);
                assert.equal(result.ip_address, testData.ipAddress);
                assert.equal(result.info, testData.info);
                done();
            });
        });

        it("should produce an error if required information for an action history is not provided", function(done) {
            // type is missing here, which is a required field
            var testData = {
                item: "ImageID",
                username: "si_user",
                ipAddress: "127.0.0.1",
                info: {
                    request_url: "upload",
                    author: "si_user"
                }
            };
            actionHistory.writeActionHistory(testData, function (err, result) {
                assert.ok(err);
                assert.equal(result, null);
                assert.equal(err.message, "Provided action history entry is missing the following required fields: type");
                done();
            });
        });

        it("should provide an error if undefined or null is passed as action entry", function(done) {
            actionHistory.writeActionHistory(undefined, function (err, result) {
                assert.ok(err);
                assert.equal(result, null);
                assert.equal(err.message, "No action entry provided.");
                actionHistory.writeActionHistory(null, function (err, result) {
                    assert.ok(err);
                    assert.equal(result, null);
                    assert.equal(err.message, "No action entry provided.");
                    done();
                });
            });
        });

        it("should not produce an error if undefined is passed as callback argument", function() {
            var testData = {
                type: "UPLOAD_IMAGE",
                item: "ImageID",
                username: "si_user",
                ipAddress: "127.0.0.1",
                info: {
                    request_url: "upload",
                    author: "si_user"
                }
            };
            // Testing all paths of writeActionHistory
            // where callback is called
            actionHistory.writeActionHistory(testData);
            actionHistory.writeActionHistory(null);
        });
    });
});