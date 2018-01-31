const ImageDatabase = require("./lib/ImageDatabase");
const Server = require("./lib/Server");

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
