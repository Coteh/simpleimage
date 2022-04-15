const express = require("express");
const format = require("../../middleware/format");
const { injectUser, requireUser } = require("../../middleware/session");
const { sendError, sendSuccess } = require("../../util/response");
const databaseOps = require("../../database-ops");
const { logger } = require("../../logger");
const commentUtil = require("../../comments");
const userUtil = require("../../user-util");

const router = express.Router();

router.get("/:username", format("html"), injectUser, function (req, res, next) {
    var username = req.params.username;
    if (username === undefined) {
        return sendError(next, {
            message: "Username entered is incorrect or malformed.",
        });
    }
    databaseOps.findUser(username, function (err, result) {
        if (err || result.length === 0) {
            return sendError(err, next, {
                message: "Could not find user " + username + ".",
                statusCode: 404,
            });
        }

        res.status(200);
        var user = result[0];
        res.append("Cache-Control", "private, max-age=0, must-revalidate");
        res.render("user-view", {
            user,
            sessionUser: req.user,
        });
        logger.info("Served user page of user " + user.username + ".");
    });
});

router.get("/:username/comments", format("json"), function (req, res, next) {
    var username = req.params.username;
    if (username === undefined) {
        return sendError(next, {
            message: "Username entered is incorrect or malformed.",
        });
    }
    databaseOps.findCommentsForUser(username, function (err, result) {
        if (err) {
            return sendError(err, next, {
                errorID: "userCommentsError",
                message: "Could not load comments for user " + username + ".",
                statusCode: 500,
            });
        }

        res.status(200);
        res.append("Cache-Control", "private, max-age=0, must-revalidate");
        res.append("Expires", "-1");
        res.append("Pragma", "no-cache");

        if (result.length === 0) {
            return sendSuccess(res, "There are currently no comments to display.", {
                data: [],
            });
        }

        const comments = result.map((comment) => ({
            username: comment.username,
            imageID: comment.image_id,
            comment: comment.comment,
            postedDate: comment.posted_date,
        }));

        const promises = comments.map(
            (comment) =>
                new Promise((resolve, reject) => {
                    databaseOps.findImageAttributes(comment.imageID, (err, results) => {
                        if (err) {
                            logger.error(
                                `Could not find attributes for image of ID ${comment.imageID} for user comments page, err: `,
                                err
                            );
                            return reject(err);
                        }
                        resolve(results);
                    });
                })
        );
        Promise.allSettled(promises).then((results) => {
            if (results.some((result) => result.status === "rejected")) {
                return sendError(err, next, {
                    message: "Could not load comments for user " + username + ".",
                    errorID: "imageAttribsError",
                    statusCode: 500,
                });
            }
            const images = results.reduce((dict, result) => {
                if (result.status === "fulfilled" && result.value.length > 0) {
                    dict[result.value[0].id] = result.value[0];
                }
                return dict;
            }, {});
            sendSuccess(res, "", {
                data: comments.map((comment) =>
                    commentUtil.createCommentResponseObject(comment, images[comment.imageID])
                ),
            });
        });
    });
});

router.get("/:username/images", format("json"), function (req, res, next) {
    var username = req.params.username;
    if (username === undefined) {
        return sendError(next, {
            message: "Username entered is incorrect or malformed.",
        });
    }

    databaseOps.findImagesForUser(username, function (err, images) {
        if (err) {
            if (err instanceof databaseOps.UserNotFoundError) {
                return sendError(next, {
                    errorID: "userNotFound",
                    message: "Could not find user " + username + ".",
                    statusCode: 404,
                });
            } else {
                return sendError(err, next, {
                    errorID: "userImagesError",
                    message: "Could not load images for user " + username + ".",
                    statusCode: 500,
                });
            }
        }

        res.status(200);
        sendSuccess(res, "", {
            data: images.map((image) => userUtil.createUserImageResponseObject(image)),
        });
    });
});

router.get("/", format("json"), requireUser, function (req, res, next) {
    res.status(200);
    delete req.user.id;
    sendSuccess(res, req.user);
});

module.exports = router;
