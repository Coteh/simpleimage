const ImageDatabase = require("./lib/database-ops");
const Server = require("./lib/server");

var port = process.env.PORT || 3010;

ImageDatabase.startDatabaseClient(function(err) {
    if (err) {
        console.error(err);
        return;
    }
    Server.setOptions({
        rootDirName: __dirname
    });
    Server.runServer(port, function(err) {
        if (err) {
            console.error("Could not run server due to an error:");
            console.error(err);
        }
    });
});
