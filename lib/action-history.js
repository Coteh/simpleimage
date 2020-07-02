const databaseOps = require("./database-ops");

module.exports.writeActionHistory = function(actionEntry, callback) {
    if (!actionEntry) {
        if (callback) {
            callback({
                message: "No action entry provided."
            }, null);
        }
        return;
    }
    
    var actionEntryKeys = Object.keys(actionEntry);
    var requiredKeys = ["type", "item", "username"];

    var requirementsResult = requiredKeys.filter(function(item) {
        return !actionEntryKeys.includes(item);
    });

    if (requirementsResult.length !== 0) {
        callback({
            message: "Provided action history entry is missing the following required fields: " + requirementsResult.toString()
        }, null);
        return;
    }

    databaseOps.writeActionHistoryEntry({
        type: actionEntry.type,
        item: actionEntry.item,
        username: actionEntry.username,
        unregisteredSessionID: actionEntry.unregisteredSessionID,
        ipAddress: actionEntry.ipAddress,
        info: actionEntry.info
    }, function (err, result) {
        if (callback) {
            callback(err, result);
        }
    });
};