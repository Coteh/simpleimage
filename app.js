require("dotenv").config();
const databaseOps = require("./lib/database-ops");
const server = require("./lib/server");
const logger = require("./lib/logger").logger;

var port = process.env.PORT || 3010;

databaseOps.startDatabaseClient((err, database) => {
    if (err) {
        return logger.error(err);
    }
    server.runServer(port, (err) => {
        if (err) {
            return logger.error(`Could not run server due to an error: ${err}`);
        }
        database.on("close", () => {
            logger.info(`Database has been closed, stopping server...`);
            server.closeServer((err) => {
                if (err) {
                    return logger.error(`Could not stop server due to an error: ${err}`);
                }
                logger.info("Server has been stopped. Exiting process...");
                process.exit(1);
            });
        });
    });
});
