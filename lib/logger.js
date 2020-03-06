const winston = require("winston");

const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: "simpleimage" },
    transports: [
        new winston.transports.File({
            name: "si_error",
            filename: "logs/si_error.log",
            level: "error"
        }),
        new winston.transports.File({
            name: "si_combined",
            filename: "logs/si_combined.log"
        })
    ]
});

if (process.env.NODE_ENV !== "production") {
    logger.add(new winston.transports.Console({
        name: "si_cli",
        format: winston.format.cli()
    }));
    if (process.env.NODE_ENV === "test") {
        logger.transports["si_error"].silent = true;
        logger.transports["si_combined"].silent = true;
        logger.transports["si_cli"].silent = true;
    }
}

module.exports.logger = logger;
