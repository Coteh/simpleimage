const express = require("express");
const databaseOps = require("../../database-ops");
const format = require("../../middleware/format");
const { authLimiter } = require("../../middleware/rate-limit");
const { sendError, sendSuccess } = require("../../util/response");
const util = require("../../util");

const router = express.Router();

router.get("/", format("html-minimal"), function (req, res, next) {
    res.render("login-view", function (err, html) {
        if (err) {
            return sendError(err, next, {
                message: "Cannot render login page.",
            });
        }

        res.status(200).send(html);
    });
});

router.post("/", format("json"), authLimiter, function (req, res, next) {
    if (req.body.username === "" || req.body.username === undefined) {
        return sendError(next, {
            statusCode: 422,
            message: "Could not login user. Missing username.",
            errorID: "missingUsername",
            field: "username",
        });
    }
    if (req.body.password === "" || req.body.password === undefined) {
        return sendError(next, {
            statusCode: 422,
            message: "Could not login user. Missing password.",
            errorID: "missingPassword",
            field: "password",
        });
    }

    var userData = {
        username: req.body.username,
        password: req.body.password,
    };

    databaseOps.loginUser(userData, function (err, result) {
        if (err) {
            return sendError(err, next, {
                errorID:
                    err instanceof databaseOps.UserPassComboNotFoundError
                        ? "userPassComboNotFound"
                        : "loginUserDatabaseError",
                statusCode: err instanceof databaseOps.UserPassComboNotFoundError ? 401 : 500,
                fields: ["username", "password"],
            });
        }
        req.session.userID = result.user._id;
        res.status(200);
        sendSuccess(res, result.message, {
            username: util.escapeOutput(result.user.username),
        });
    });
});

module.exports = router;
