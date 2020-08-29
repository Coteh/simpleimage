const express = require("express");
const route = require("./routes/route");
const https = require('https');
const fs = require("fs");
const logger = require("./logger").logger;

var app = express();
var router = express.Router();
let httpServer, httpsServer;

app.use(express.static("public"));
app.set("view engine", "ejs");

route(app, router);

module.exports.runServer = function(portNumber, callback) {
    httpServer = app.listen(portNumber, () => {
        logger.info("Server running at http://localhost:" + portNumber + "/");
    });
    // HTTPS server is used in dev only, heroku provides SSL in production
    if (process.env.NODE_ENV === "development" && process.env.USE_DEV_HTTPS === 'true') {
        httpsServer = https.createServer({
            key: fs.readFileSync('./ssl/localhost+2-key.pem'),
            cert: fs.readFileSync('./ssl/localhost+2.pem'),
        }, app).listen(3011, () => {
            logger.info("Dev HTTPS Server running at " + 3011);
        });
    }

    if (callback) {
        callback(null);
    }
};

module.exports.closeServer = function(callback) {
    if (httpServer) {
        httpServer.close();
    } else {
        if (callback) {
            callback("No server instance exists.");
        }
        return;
    }
    if (process.env.NODE_ENV === "development" && process.env.USE_DEV_HTTPS === 'true') {
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
