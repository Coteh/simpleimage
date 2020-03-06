const winston = require("winston");

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

if (process.env.NODE_ENV !== "production") {
    logger.add(new winston.transports.Console({
        name: "si_cli",
        format: winston.format.cli(),
        silent: (process.env.NODE_ENV === "test"),
    }));
}

module.exports.logger = logger;
