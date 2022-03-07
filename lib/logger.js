const winston = require("winston");
const getDBHostURI = require("./db-util").getDBHostURI;

require("winston-mongodb");

const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: "simpleimage" },
    transports: [
        new winston.transports.File({
            filename: "logs/si_error.log",
            level: "error",
            silent: process.env.NODE_ENV === "test",
        }),
        new winston.transports.File({
            filename: "logs/si_combined.log",
            silent: process.env.NODE_ENV === "test",
        }),
    ],
});

if (process.env.NODE_ENV !== "test") {
    logger.add(
        new winston.transports.MongoDB({
            db: getDBHostURI(),
            silent: process.env.NODE_ENV === "test",
            collection: "log",
        })
    );
}

// TODO add dedicated config object so that the e2e environment variable can be mapped nicely to a boolean
if (process.env.NODE_ENV !== "production" || process.env.IS_E2E === "true") {
    logger.add(
        new winston.transports.Console({
            name: "si_cli",
            format: winston.format.cli(),
            silent: process.env.NODE_ENV === "test",
        })
    );
}

module.exports.logger = logger;
