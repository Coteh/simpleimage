const express = require("express");
const fs = require("fs");
const { logger } = require("../../logger");
const databaseOps = require("../../database-ops");
const { sendError, sendSuccess } = require("../../util/response");
const util = require("../../util");
const commentUtil = require("../../comments");
const format = require("../../middleware/format");
const { injectUser, requireUser } = require("../../middleware/session");
const actionHistory = require("../../action-history");
const { limiter } = require("../../middleware/rate-limit");
const sharp = require("sharp");
const bmp = require("@vingle/bmp-js");
const gifResize = require("@gumlet/gif-resize");

const router = express.Router();

let imgDoesNotExist;
try {
    imgDoesNotExist = fs.readFileSync("./img/ImageDoesNotExist.png");
} catch (e) {
    throw new Error(`Could not load placeholder image: ${e}`);
}

router.get("/:id.:ext", function (req, res, next) {
    var id = util.getIDFromParam(req.params.id);
    if (id === undefined || id === "removed") {
        // return placeholder image
        res.status(200);
        res.append("Cache-Control", "public, max-age=2592000");
        res.type("image/png");
        res.send(imgDoesNotExist); // Send the file data to the browser.
        return logger.info("Served 'removed' placeholder image by direct link");
    }
    databaseOps.findImage(id, function (err, imageEntry) {
        const serveImage = function (imageBuffer, lowRes) {
            res.status(200);
            res.append("Cache-Control", "public, max-age=2592000");
            res.type(imageEntry[0].mimetype);
            res.send(imageBuffer); // Send the file data to the browser.
            if (lowRes) {
                logger.info(`Served low resolution image ${imageEntry[0].id} by direct link`);
            } else {
                logger.info(`Served image ${imageEntry[0].id} by direct link`);
            }
        };
        if (err) {
            logger.error("Error finding image from database", err);
            return sendError(err, next, {
                message: "Error finding image. Please try again later.",
                statusCode: 500,
            });
        }
        if (
            imageEntry.length == 0 ||
            (req.params.ext !== undefined && util.extToMimeType(req.params.ext) !== imageEntry[0].mimetype)
        ) {
            logger.error(
                `Could not find image of ID ${id} for direct link, serving "removed" placeholder image via redirect`
            );
            res.redirect("/images/removed.png");
        } else {
            if (req.query.res && req.query.res === "low") {
                const mimeType = util.extToMimeType(req.params.ext);
                if (mimeType === "image/jpeg") {
                    sharp(imageEntry[0].data.buffer)
                        .jpeg({ quality: 40 })
                        .toBuffer()
                        .then((imageBuffer) => {
                            serveImage(imageBuffer, true);
                        })
                        .catch((err) => {
                            logger.warn(
                                `Could not reduce jpeg image to low resolution, serving original image. ${err}`
                            );
                            serveImage(imageEntry[0].data.buffer, false);
                        });
                } else if (mimeType === "image/png") {
                    sharp(imageEntry[0].data.buffer)
                        .png({ quality: 40 })
                        .toBuffer()
                        .then((imageBuffer) => {
                            serveImage(imageBuffer, true);
                        })
                        .catch((err) => {
                            logger.warn(`Could not reduce png image to low resolution, serving original image. ${err}`);
                            serveImage(imageEntry[0].data.buffer, false);
                        });
                } else if (mimeType === "image/gif") {
                    sharp(imageEntry[0].data.buffer)
                        .metadata()
                        .then((info) => {
                            var resizeDimensions = Math.round(info.width / 2);
                            return gifResize({ width: resizeDimensions })(imageEntry[0].data.buffer);
                        })
                        .then((imageBuffer) => {
                            serveImage(imageBuffer, true);
                        })
                        .catch((err) => {
                            logger.warn(`Could not reduce gif image to low resolution, serving original image. ${err}`);
                            serveImage(imageEntry[0].data.buffer, false);
                        });
                } else if (mimeType === "image/bmp") {
                    const reduceBMP = async () => {
                        const bitmap = bmp.decode(imageEntry[0].data.buffer, true);
                        await sharp(bitmap.data, {
                            raw: {
                                width: bitmap.width,
                                height: bitmap.height,
                                channels: 4,
                            },
                        })
                            .toFormat("png")
                            .png({ quality: 40 })
                            .toBuffer()
                            .then((imageBuffer) => {
                                serveImage(imageBuffer, true);
                            });
                    };
                    reduceBMP().catch((err) => {
                        logger.warn(`Could not reduce bmp image to low resolution, serving original image. ${err}`);
                        serveImage(imageEntry[0].data.buffer, false);
                    });
                } else {
                    logger.warn(`Unsupported image type for low resolution, serving original image.`);
                    serveImage(imageEntry[0].data.buffer, false);
                }
            } else {
                serveImage(imageEntry[0].data.buffer, false);
            }
        }
    });
});

router.get("/:id", format("html"), injectUser, function (req, res, next) {
    if (req.path[req.path.length - 1] === ".") {
        return sendError(next, {
            message: "Malformed url.",
        });
    }
    var id = util.getIDFromParam(req.params.id);
    if (id === undefined) {
        return sendError(next, {
            message: "Incorrect or malformed image ID.",
        });
    }
    databaseOps.findImage(id, function (err, imageEntry) {
        if (err || imageEntry.length == 0) {
            sendError(err, next, {
                message: "Image of this ID does not exist on the database.",
                statusCode: 404,
            });
        } else {
            res.status(200);
            res.append("Cache-Control", "private, max-age=0, must-revalidate");
            res.render("image-view", {
                id,
                imageSrc: id + "." + util.mimeTypeToExt(imageEntry[0].mimetype),
                uploadedDate: imageEntry[0].uploadeddate || "Unknown Date",
                author: imageEntry[0].username,
                user: req.user,
            });
            logger.info("Served image " + imageEntry[0].id + " via image page");
        }
    });
});

router.get("/:id/comments", format("json"), function (req, res, next) {
    var id = util.getIDFromParam(req.params.id);
    if (id === undefined) {
        return sendError(next, {
            message: "Incorrect or malformed image ID.",
        });
    }
    databaseOps.findCommentsForImage(id, function (err, result) {
        if (err) {
            return sendError(err, next, {
                errorID: "imageCommentsError",
                message: "Could not load comments for image of image ID " + id + ".",
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

        sendSuccess(res, "", {
            data: comments.map((comment) => commentUtil.createCommentResponseObject(comment)),
        });
    });
});

router.delete("/:id", format("json"), requireUser, limiter, function (req, res, next) {
    var id = util.getIDFromParam(req.params.id);
    if (id === undefined) {
        return sendError(err, next, {
            statusCode: 400,
            message: "Incorrect or malformed image ID.",
            errorID: "invalidImageID",
        });
    }
    databaseOps.findImage(id, function (err, imageEntry) {
        if (err || imageEntry.length == 0) {
            return sendError(err, next, {
                statusCode: 404,
                message: "Image of this ID does not exist on the database.",
                errorID: "imageNotFound",
            });
        }
        if (imageEntry[0].username !== req.user.username) {
            return sendError(next, {
                statusCode: 403,
                message: "You are not authorized to delete this image.",
                errorID: "notAuthorized",
            });
        }
        databaseOps.deleteImage(id, function (err, result) {
            if (err) {
                return sendError(err, next, {
                    errorID: "databaseError",
                });
            }
            logger.info("Deleted image " + id + ".");
            actionHistory.writeActionHistory(
                {
                    type: "DELETE_IMAGE",
                    item: id,
                    username: req.user.username,
                    ipAddress: req.ip,
                    info: {
                        request_url: req.url,
                        author: imageEntry[0].username,
                    },
                },
                function (err, result) {
                    if (err) {
                        logger.error(err);
                    }
                }
            );
            res.status(200);
            sendSuccess(res, "Image of ID " + id + " deleted successfully.");
        });
    });
});

module.exports = router;
