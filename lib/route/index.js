const express = require("express");
const format = require("../middleware/format");
const { injectUser } = require("../middleware/session");
const { getExpireTimeString, getFileSizeLimitString, getValidImageTypesString } = require("../util");
const { DEFAULT_FILE_SIZE_LIMIT } = require("../consts");

const router = express.Router();

router.get(["/", "/index.htm(l|)"], format("html"), injectUser, function (req, res, next) {
    res.status(200);
    res.append("Cache-Control", "private, max-age=0, must-revalidate");
    res.render("index", {
        user: req.user,
        expireTimeString: getExpireTimeString(
            parseInt(process.env.EXPIRE_AFTER_SECONDS) || 300,
            process.env.EVALUATION_MODE === "true"
        ),
        fileSizeLimitString: getFileSizeLimitString(parseInt(process.env.FILE_SIZE_LIMIT) || DEFAULT_FILE_SIZE_LIMIT),
        validImageTypesString: getValidImageTypesString(),
    });
});

module.exports = router;
