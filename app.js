const ImageDatabase = require('./lib/ImageDatabase');
const Server = require('./lib/Server');

ImageDatabase.startDatabaseClient(function(err) {
    if (err) {
        console.error(err);
        return;
    }
    Server.setOptions({
        rootDirName: __dirname
    });
    Server.runServer(9001, function(err) {
        var dbConfigErr = false;
        ImageDatabase.getConfigFromDatabase(function(err, config) {
            if (err) {
                console.log("There was an error retrieving config options from the database.");
                dbConfigErr = true;
                return;
            }
            if (typeof(config) === "undefined") {
                console.log("No config options currently exist in database, instantiating a fresh set and adding to database...");
                ImageDatabase.insertNewConfig();
            }
            console.log("Here are the current config options:");
            ImageDatabase.printCurrentConfig();
            console.log("Now applying them to the server instance...");
            ImageDatabase.applyConfigOptions();
        });
        if (dbConfigErr) {
            console.log("ERROR: DB configs could not be loaded. Disconnecting server and connection to db and exiting...");
            ImageDatabase.closeDatabaseClient();
            Server.closeServer();
            return;
        }
        if (process.argv.length > 2) {
            if (process.argv[2] == "print-config") {
                ImageDatabase.printCurrentConfig();
            }
        }
    });
});
