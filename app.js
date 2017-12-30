const ImageDatabase = require("./lib/ImageDatabase");
const Server = require("./lib/Server");

ImageDatabase.startDatabaseClient(function(err) {
    if (err) {
        console.error(err);
        return;
    }
    Server.setOptions({
        rootDirName: __dirname
    });
    Server.runServer(9001, function(err) {
        if (err) {
            console.error("Could not run server due to an error:");
            console.error(err);
        }
    });
});
