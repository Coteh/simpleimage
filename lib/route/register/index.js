const express = require("express");
const usernameUtil = require("../../util/username");
const passwordUtil = require("../../util/password");
const databaseOps = require("../../database-ops");
const actionHistory = require("../../action-history");
const { logger } = require("../../logger");
const { sendError, sendSuccess } = require("../../util/response");
const format = require("../../middleware/format");
const { limiter } = require("../../middleware/rate-limit");
const validator = require("validator");

const router = express.Router();

router.get("/", format("html-minimal"), function (req, res, next) {
    res.render("register-view", function (err, html) {
        if (err) {
            return sendError(err, next, {
                message: "Cannot render register page.",
            });
        }

        res.status(200).send(html);
    });
});

router.post("/", format("json"), limiter, function (req, res, next) {
    if (req.body.username === undefined || req.body.username === "") {
        return sendError(next, {
            statusCode: 422,
            message: "Could not register user. Missing username.",
            errorID: "usernameEmpty",
            field: "username",
        });
    }
    if (req.body.password === undefined || req.body.password === "") {
        return sendError(next, {
            statusCode: 422,
            message: "Could not register user. Missing password.",
            errorID: "passwordEmpty",
            field: "password",
        });
    }
    if (req.body.passwordConfirm === undefined || req.body.passwordConfirm === "") {
        return sendError(next, {
            statusCode: 422,
            message: "Could not register user. Missing password confirmation.",
            errorID: "passwordConfirmEmpty",
            field: "passwordConfirm",
        });
    }
    if (req.body.email === undefined || req.body.email === "") {
        return sendError(next, {
            statusCode: 422,
            message: "Could not register user. Missing email.",
            errorID: "emailEmpty",
            field: "email",
        });
    }

    if (req.body.password !== req.body.passwordConfirm) {
        return sendError(next, {
            statusCode: 400,
            errorID: "passwordMismatch",
            message: "Could not register user. Passwords don't match.",
            fields: ["password", "passwordConfirm"],
        });
    }

    if (!validator.isEmail(req.body.email)) {
        return sendError(next, {
            statusCode: 400,
            message: "Could not register user. Invalid email.",
            errorID: "emailInvalid",
            field: "email",
        });
    }

    const usernameCheckResult = usernameUtil.isValidUsername(req.body.username);
    if (!usernameCheckResult.valid) {
        switch (usernameCheckResult.error) {
            case usernameUtil.UsernameError.USERNAME_TOO_LONG:
                logger.error(`Could not register user ${req.body.username}. Username contains too many characters.`);
                sendError(next, {
                    statusCode: 400,
                    message: "Could not register user. Username contains too many characters.",
                    errorID: "usernameTooLong",
                    field: "username",
                });
                break;
            default:
                logger.error(`Could not register user ${req.body.username}. Unknown error with username check.`);
                sendError(next, {
                    statusCode: 400,
                    message: "Could not register user. Unknown error.",
                    errorID: "usernameUnknownError",
                });
        }
        return;
    }

    const passwordStrengthResult = passwordUtil.verifyPasswordStrength(req.body.password);
    if (!passwordStrengthResult.strong) {
        return sendError(next, {
            statusCode: 400,
            message: passwordStrengthResult.errors.join("\n"),
            errorID: "passwordNotStrong",
            fields: ["password", "passwordConfirm"],
        });
    }

    var userData = {
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
    };

    databaseOps.addUser(userData, function (err, result) {
        if (err) {
            let field;
            let statusCode = 500;
            let errorID = "databaseError";
            let errMsg = "Unknown error.";
            if (err.message !== undefined) {
                errMsg = err.message;
            } else {
                if (err.name === "DuplicateField") {
                    if (err.field === "username") {
                        errMsg = "Username already exists.";
                        field = "username";
                        statusCode = 400;
                        errorID = "usernameTaken";
                    }
                }
            }
            return sendError(err, next, {
                statusCode,
                message: errMsg,
                errorID,
                field,
            });
        }

        req.session.userID = result.insertedId;

        logger.info("User '" + userData.username + "' has been registered.");
        actionHistory.writeActionHistory(
            {
                type: "REGISTER_USER",
                item: userData.username,
                username: userData.username,
                ipAddress: req.ip,
                info: {
                    request_url: req.url,
                },
            },
            function (err, result) {
                if (err) {
                    logger.error(err);
                }
            }
        );

        res.status(200);
        sendSuccess(res, "User registered.");
    });
});

module.exports = router;
