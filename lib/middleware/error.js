const logger = require("../logger").logger;

function renderError(res, statusCode, message, errorID, additionalInfo) {
    if (message === undefined) {
        message = "There was an error loading this page. Please try again later.";
    }
    if (statusCode === undefined) {
        statusCode = 500;
    }
    res.status(statusCode);
    res.render("error", {
        message,
        errorID,
        additionalInfo,
    });
}

module.exports = (err, req, res, next) => {
    logger.error("Router has encountered an error: " + (err.stack || "No stack found for this error."));
    const statusCode = err.statusCode || 500;
    switch (req.format) {
        case "html":
            renderError(res, statusCode, err.message, err.errorID, err.additionalInfo);
            break;
        case "html-minimal":
            res.status(statusCode).send(
                `<div><span id="err-message">${err.message}</span>${
                    err.errorID
                        ? `<br/><span><b>Error ID:</b> <span id="err-id">${err.errorID}</span></span></div>`
                        : ""
                }`
            );
            break;
        default:
            //json
            res.status(statusCode).send({
                status: "error",
                message: err.message || "failed",
                errorID: err.errorID,
                additionalInfo: err.additionalInfo,
            });
            break;
    }
};
