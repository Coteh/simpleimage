const databaseOps = require("./database-ops");

module.exports.writeActionHistory = function(actionType, actionEntity, actionItem, actionUsername, actionInfo) {
    databaseOps.writeActionHistoryEntry({
        actionType,
        actionEntity,
        actionItem,
        actionUsername,
        actionInfo
    }, function (err, result) {
        if (err) {
            console.error(err);
        }
    });
};