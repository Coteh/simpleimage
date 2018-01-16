const ImageDatabase = require("./ImageDatabase");

const SeverityLevel = Object.freeze({
    NONE: 0,
    INFO: 1,
    TRACE: 2,
    WARN: 3,
    ERROR: 4
});

var getSeverityString = function(severity) {
    switch (severity) {
        case SeverityLevel.INFO:
            return "INFO";
        case SeverityLevel.TRACE:
            return "TRACE";
        case SeverityLevel.WARN:
            return "WARN";
        case SeverityLevel.ERROR:
            return "ERROR";
        case SeverityLevel.NONE:
        default:
            return "";
    }
};

var writeLog = function(text, severity, info) {
    console.log(getSeverityString(severity) + "> " + text);
    ImageDatabase.writeLogEntry({
        text: text,
        severity: getSeverityString(severity),
        info: info
    }, function(err, callback) {
        if (err) {
            console.error(err.message);
            return;
        }
    });
};

var writeError = function(text, info) {
    writeLog(text, SeverityLevel.ERROR, info);
};

module.exports.SeverityLevel = SeverityLevel;
module.exports.writeLog = writeLog;
module.exports.writeError = writeError;

if (process.env.NODE_ENV === "test") {
    module.exports.getSeverityString = getSeverityString;
}