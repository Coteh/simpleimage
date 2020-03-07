const databaseOps = require("./lib/database-ops");
const server = require("./lib/server");
const logger = require("./lib/logger");

var port = process.env.PORT || 3010;

databaseOps.startDatabaseClient(function(err) {
    if (err) {
        logger.error(err);
        return;
    }
    server.setOptions({
        rootDirName: __dirname
    });
    server.runServer(port, function(err) {
        if (err) {
            logger.error("Could not run server due to an error:");
            logger.error(err);
        }
    });
});
