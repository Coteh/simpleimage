const express = require("express");
const passwordUtil = require("../../util/password");
const format = require("../../middleware/format");
const { limiter } = require("../../middleware/rate-limit");
const { requireUser, requireUserWithMessage } = require("../../middleware/session");
const { sendError, sendSuccess } = require("../../util/response");
const databaseOps = require("../../database-ops");
const auth = require("../../auth");
const actionHistory = require("../../action-history");
const { logger } = require("../../logger");

const router = express.Router();

router.get(
    "/",
    format("html"),
    requireUserWithMessage("You must be logged in to access this page."),
    function (req, res, next) {
        res.render("settings-view", {
            sessionUser: req.user,
        });
    }
);

router.post("/change_password", format("json"), requireUser, limiter, function (req, res, next) {
    var userData = req.user;

    if (req.body.oldPassword === undefined || req.body.oldPassword === "") {
        return sendError(next, {
            errorID: "missingOldPassword",
            message: "Could not change password. Missing old password.",
            field: "oldPassword",
            statusCode: 422,
        });
    }
    if (req.body.newPassword === undefined || req.body.newPassword === "") {
        return sendError(next, {
            errorID: "missingNewPassword",
            message: "Could not change password. Missing new password.",
            field: "newPassword",
            statusCode: 422,
        });
    }
    if (req.body.newPasswordConfirm === undefined || req.body.newPasswordConfirm === "") {
        return sendError(next, {
            errorID: "missingNewPasswordConfirm",
            message: "Could not change password. Missing new password confirmation.",
            field: "newPasswordConfirm",
            statusCode: 422,
        });
    }

    databaseOps.findUser(userData.username, async function (err, results) {
        if (err || results.length === 0) {
            let errMsg = "Could not change password.";
            let errID = "databaseError";
            let statusCode = 500;
            if (err) {
                logger.error(err.stack);
            } else {
                logger.error("Could not find user '" + userData.username + "' in database");
                errMsg = "Could not change password. Could not find user in database.";
                errID = "userNotFound";
                statusCode = 404;
            }
            return sendError(next, {
                errorID: errID,
                message: errMsg,
                statusCode,
            });
        }

        var user = results[0];

        var result = false;
        try {
            result = await auth.authenticateUser(user, req.body.oldPassword);
        } catch (e) {
            logger.error("Error authenticating old password of user", e);
        }

        if (!result) {
            return sendError(next, {
                errorID: "oldPasswordIncorrect",
                message: "Could not change password. Old password is not correct.",
                field: "oldPassword",
                statusCode: 400,
            });
        }

        if (req.body.newPassword !== req.body.newPasswordConfirm) {
            return sendError(next, {
                errorID: "passwordsDoNotMatch",
                message: "Could not change password. Passwords don't match.",
                fields: ["newPassword", "newPasswordConfirm"],
                statusCode: 400,
            });
        }

        if (req.body.newPassword === req.body.oldPassword) {
            return sendError(next, {
                errorID: "passwordSame",
                message: "Could not change password. New password is the same as the old password.",
                fields: ["oldPassword", "newPassword", "newPasswordConfirm"],
                statusCode: 400,
            });
        }

        let passwordStrengthResult = passwordUtil.verifyPasswordStrength(req.body.newPassword);

        if (!passwordStrengthResult.strong) {
            return sendError(next, {
                errorID: "passwordNotStrong",
                message: passwordStrengthResult.errors.join("\n"),
                fields: ["newPassword", "newPasswordConfirm"],
                statusCode: 400,
            });
        }

        databaseOps
            .changeUserPassword(user._id, req.body.newPassword)
            .then((result) => {
                logger.info("User '" + userData.username + "' password has been changed.");
                actionHistory.writeActionHistory(
                    {
                        type: "USER_CHANGE_PASSWORD",
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
                sendSuccess(res, "Password changed.");
            })
            .catch((err) => {
                sendError(next, {
                    errorID: "errorChangingPassword",
                    message: err.message,
                    fields: ["newPassword", "newPasswordConfirm"],
                    statusCode: 500,
                });
            });
    });
});

module.exports = router;
