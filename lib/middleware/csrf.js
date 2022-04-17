const csurf = require("csurf");

let csurfOptions = { cookie: false };
// TODO add dedicated config object so that the e2e environment variable can be mapped nicely to a boolean
if (process.env.NODE_ENV !== "production" || process.env.IS_E2E === "true") {
    csurfOptions.ignoreMethods = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"];
}

module.exports.csrfProtection = csurf(csurfOptions);

module.exports.injectCsrfToken = (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
};
