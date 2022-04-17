const express = require("express");
const { sendError, sendSuccess } = require("../../util/response");
const util = require("../../util");
const databaseOps = require("../../database-ops");
const actionHistory = require("../../action-history");
const { logger } = require("../../logger");
const { requireUserWithMessage } = require("../../middleware/session");
const { commentsLimiter } = require("../../middleware/rate-limit");
const format = require("../../middleware/format");

const router = express.Router();

router.post(
    "/",
    format("json"),
    requireUserWithMessage("Could not post comment. Not signed in."),
    commentsLimiter,
    function (req, res, next) {
        if (!req.body.imageID) {
            return sendError(next, {
                statusCode: 422,
                message: "Could not post comment. Missing image ID.",
                errorID: "missingImageID",
            });
        }
        if (!req.body.comment) {
            return sendError(next, {
                statusCode: 422,
                message: "Could not post comment. Missing comment.",
                errorID: "missingComment",
            });
        }

        var userHiddenID = req.session.userID;

        var imageID = util.getIDFromParam(req.body.imageID);
        if (imageID === undefined) {
            return sendError(next, {
                statusCode: 422,
                message: "Could not post comment. Invalid image ID.",
                errorID: "invalidImageID",
            });
        }

        databaseOps.findImage(imageID, function (err, imageEntry) {
            if (err || imageEntry.length == 0) {
                return sendError(err, next, {
                    statusCode: 404,
                    message: "Image of this ID does not exist on the database.",
                    errorID: "imageNotFound",
                });
            }
            databaseOps.addComment(
                {
                    userHiddenID,
                    imageID,
                    comment: req.body.comment,
                },
                function (err, result) {
                    if (err) {
                        logger.error(`Error occurred when adding comment: ${err.message}`);
                        return sendError(err, next, {
                            errorID: "databaseError",
                        });
                    }
                    var comment = result.ops[0];

                    logger.info("Comment on image " + imageID + " posted by user " + comment.username + ".");
                    actionHistory.writeActionHistory(
                        {
                            type: "POST_COMMENT",
                            item: comment.image_id,
                            username: comment.username,
                            ipAddress: req.ip,
                            info: {
                                request_url: req.url,
                                comment_id: comment._id,
                                comment_text: comment.comment,
                            },
                        },
                        function (err, result) {
                            if (err) {
                                logger.error(err);
                            }
                        }
                    );

                    res.status(200);
                    sendSuccess(res, "", {
                        comment: {
                            userID: comment.user_id,
                            imageID: comment.image_id,
                            username: util.escapeOutput(comment.username),
                            comment: util.escapeOutput(comment.comment),
                            postedDate: comment.posted_date,
                        },
                    });
                }
            );
        });
    }
);

module.exports = router;
