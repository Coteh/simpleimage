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
            silent: (process.env.NODE_ENV === "test"),
        }),
        new winston.transports.File({
            filename: "logs/si_combined.log",
            silent: (process.env.NODE_ENV === "test"),
        })
    ]
});

if (process.env.NODE_ENV !== "test") {
    logger.add(new winston.transports.MongoDB({
        db: getDBHostURI(),
        silent: (process.env.NODE_ENV === "test"),
        collection: "log"
    }));
}

if (process.env.NODE_ENV !== "production") {
    logger.add(new winston.transports.Console({
        name: "si_cli",
        format: winston.format.cli(),
        silent: false,
    }));
}

module.exports.logger = logger;
