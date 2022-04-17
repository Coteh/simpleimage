const express = require("express");
const format = require("../../middleware/format");
const { limiter } = require("../../middleware/rate-limit");
const { sendError, sendSuccess } = require("../../util/response");
const usernameUtil = require("../../util/username");
const logger = require("../../logger").logger;
const databaseOps = require("../../database-ops");

const router = express.Router();

router.get("/username", format("json"), limiter, function (req, res, next) {
    let username = req.query.username;
    if (!username) {
        // TODO make the ordering of properties consistent for all error responses
        return sendError(next, {
            message: "No username to check.",
            errorID: "noUsernameToCheck",
            statusCode: 400,
        });
    }
    if (typeof username !== "string") {
        if (Array.isArray(username)) {
            username = username[0];
        } else {
            return sendError(next, {
                message: "Invalid username specified.",
                errorID: "invalidUsernameToCheck",
                statusCode: 400,
            });
        }
    }
    const usernameCheckResult = usernameUtil.isValidUsername(username);
    if (!usernameCheckResult.valid) {
        let errorID;
        let message;
        switch (usernameCheckResult.error) {
            case usernameUtil.UsernameError.USERNAME_TOO_LONG:
                errorID = "usernameTooLong";
                message = "Username contains too many characters.";
                break;
            default:
                errorID = "usernameUnknownError";
                message = "Unknown error. Try again later.";
        }
        return sendError(next, {
            message,
            errorID,
            statusCode: 400,
        });
    }
    logger.info("Checking for existence of user " + username + ".");
    databaseOps.findUser(username, function (err, result) {
        if (err) {
            return sendError(err, next, {
                message: "Error checking user",
                errorID: "errorCheckingUser",
                statusCode: (err.message === "Invalid username") ? 400 : 500,
            });
        }

        const exists = result.length > 0;
        logger.info("User " + username + (exists ? " exists." : " does not exist."));
        res.status(200);
        sendSuccess(res, "", {
            exists,
        });
    });
});

module.exports = router;
