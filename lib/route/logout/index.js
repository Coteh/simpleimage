const express = require("express");
const util = require("../../util");
const { limiter } = require("../../middleware/rate-limit");

const router = express.Router();

router.post("/", limiter, function (req, res, next) {
    req.session.destroy();
    var referrer = req.header("Referer");
    if (referrer && referrer.indexOf("/settings") >= 0) {
        res.redirect(util.getRedirectPath("/"));
    } else {
        res.redirect(util.getRedirectPath(referrer));
    }
});

module.exports = router;
