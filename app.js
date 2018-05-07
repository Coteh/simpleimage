const databaseOps = require("./lib/database-ops");
const server = require("./lib/server");

var port = process.env.PORT || 3010;

databaseOps.startDatabaseClient(function(err) {
    if (err) {
        console.error(err);
        return;
    }
    server.setOptions({
        rootDirName: __dirname
    });
    server.runServer(port, function(err) {
        if (err) {
            console.error("Could not run server due to an error:");
            console.error(err);
        }
    });
});
