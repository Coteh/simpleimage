const express = require("express");
const https = require("https");
const fs = require("fs");
const { logger } = require("./logger");
const bodyParser = require("body-parser");
const { sessionsMiddleware } = require("./middleware/session");
const { csrfProtection, injectCsrfToken } = require("./middleware/csrf");
const errorHandler = require("./middleware/error");

var app = express();
var router = express.Router();
let httpServer, httpsServer;

app.use(express.static("public"));
app.set("view engine", "ejs");
app.disable("x-powered-by");

app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);
app.set("trust proxy", 1);

app.use(sessionsMiddleware());

app.use(csrfProtection);
app.use(injectCsrfToken);

router.use("/", require("./route"));

const imagesRouter = require("./route/image");
router.use("/images", imagesRouter);
router.use("/image", imagesRouter);
router.use("/i", imagesRouter);

const usersRouter = require("./route/user");
router.use("/users", usersRouter);
router.use("/user", usersRouter);
router.use("/u", usersRouter);

router.use("/upload", require("./route/upload"));

router.use("/comment", require("./route/comment"));

router.use("/login", require("./route/login"));
router.use("/register", require("./route/register"));
router.use("/logout", require("./route/logout"));

router.use("/check", require("./route/check"));

router.use("/settings", require("./route/settings"));

app.use("/", router);

app.use(errorHandler);

module.exports.runServer = function (portNumber, callback) {
    httpServer = app.listen(portNumber, () => {
        logger.info("Server running at http://localhost:" + portNumber + "/");
    });
    // HTTPS server is used in dev only, Fly.io provides SSL in production
    if (process.env.NODE_ENV === "development" && process.env.USE_DEV_HTTPS === "true") {
        httpsServer = https
            .createServer(
                {
                    key: fs.readFileSync("./ssl/localhost+2-key.pem"),
                    cert: fs.readFileSync("./ssl/localhost+2.pem"),
                },
                app
            )
            .listen(3011, () => {
                logger.info("Dev HTTPS Server running at " + 3011);
            });
    }

    if (callback) {
        callback(null);
    }
};

module.exports.closeServer = function (callback) {
    if (httpServer) {
        httpServer.close();
    } else {
        if (callback) {
            callback("No server instance exists.");
        }
        return;
    }
    if (process.env.NODE_ENV === "development" && process.env.USE_DEV_HTTPS === "true") {
        if (httpsServer) {
            httpsServer.close();
        } else {
            if (callback) {
                callback("No dev https server instance exists.");
            }
            return;
        }
    }
    if (callback) {
        callback(null);
    }
};

if (process.env.NODE_ENV === "test") {
    module.exports.app = app;
}
