const ImageDatabase = require("./ImageDatabase");

module.exports.writeActionHistory = function(actionType, actionEntity, actionItem, actionUsername, actionInfo) {
    ImageDatabase.writeActionHistoryEntry({
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