const express = require("express");
const format = require("../middleware/format");
const { injectUser } = require("../middleware/session");

const router = express.Router();

router.get(["/", "/index.htm(l|)"], format("html"), injectUser, function (req, res, next) {
    res.status(200);
    res.append("Cache-Control", "private, max-age=0, must-revalidate");
    res.render("index", {
        user: req.user,
    });
});

module.exports = router;
