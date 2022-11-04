const express = require("express");
const format = require("../../middleware/format");
const databaseOps = require("../../database-ops");
const { sendError, sendSuccess } = require("../../util/response");
const { uploadLimiter } = require("../../middleware/rate-limit");
const { injectUser } = require("../../middleware/session");
const actionHistory = require("../../action-history");
const { logger } = require("../../logger");
const { getValidImageTypesString, getFileSizeLimitString, isValidImageType } = require("../../util");
const fileType = require("file-type");
const multer = require("multer");

const router = express.Router();

const DEFAULT_FILE_SIZE_LIMIT = 500000000;

const fileSizeLimit = parseInt(process.env.FILE_SIZE_LIMIT) || DEFAULT_FILE_SIZE_LIMIT;

const upload = multer({
    limits: { fileSize: fileSizeLimit },
});

router.post("/", format("json"), injectUser, uploadLimiter, function (req, res, next) {
    var uploadFunc = upload.any();

    //If user is logged in, upload image under their username
    //Otherwise, upload anonymously

    if (req.guest && process.env.LOGIN_TO_UPLOAD === "true") {
        return sendError(next, {
            errorID: "notSignedIn",
            message: "Cannot perform action. Not signed in.",
            statusCode: 401,
        });
    }

    if (!req.user && !req.guest) {
        return sendError(next, {
            message:
                "There was an error uploading an image under this user. " +
                "User could not be found. Ensure that user hasn't been deleted and try again.",
            errorID: "sessionUserNotFound",
            statusCode: 404,
        });
    }

    var username = req.user !== undefined ? req.user.username : null;

    uploadFunc(req, res, function (err) {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return sendError(err, next, {
                    message: `Image is larger than ${getFileSizeLimitString(
                        fileSizeLimit
                    )}. Please try again with a smaller image.`,
                    errorID: "imageTooLarge",
                    statusCode: 413,
                });
            }
            return sendError(err, next);
        }

        if (!req.files || req.files.length === 0) {
            return sendError(err, next, {
                errorID: "noFilesSelected",
                message: "Nothing was selected to upload.",
                statusCode: 400,
            });
        }
        var imageEntry = {
            data: req.files[0].buffer,
            mimetype: req.files[0].mimetype,
            encoding: req.files[0].encoding,
            username: username,
        };
        var fileTypeData = fileType(imageEntry.data);
        if (fileTypeData == null || !isValidImageType(fileTypeData.mime)) {
            return sendError(next, {
                errorID: "invalidFileType",
                message:
                    "Image is not a supported file type. Please try again with a supported file type. (" +
                    getValidImageTypesString() +
                    ")",
                statusCode: 400,
            });
        }
        databaseOps.addImage(imageEntry, function (err, result) {
            if (result != null) {
                logger.info("Uploaded image " + result.ops[0].id + " successfully.");
                actionHistory.writeActionHistory(
                    {
                        type: "UPLOAD_IMAGE",
                        item: result.ops[0].id,
                        username,
                        ipAddress: req.ip,
                        info: {
                            request_url: req.url,
                            author: result.ops[0].username,
                        },
                    },
                    function (err, result) {
                        if (err) {
                            logger.error(err);
                        }
                    }
                );
                sendSuccess(res, "Image uploaded successfully.", {
                    id: result.ops[0].id,
                });
            } else {
                sendError(err, next, {
                    message: "Image upload failed.",
                });
            }
        });
    });
});

module.exports = router;
