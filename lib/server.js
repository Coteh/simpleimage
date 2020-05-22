const express = require("express");
const route = require("./routes/route");
const logger = require("./logger").logger;

var app = express();
var router = express.Router();
var server = null;

app.use(express.static("public"));
app.set("view engine", "ejs");

route(app, router);

module.exports.runServer = function(portNumber, callback) {
    server = app.listen(portNumber);

    logger.info("Server running at http://localhost:" + portNumber + "/");

    if (callback) {
        callback(null);
    }
};

module.exports.closeServer = function(callback) {
    if (server != null) {
        server.close();
    } else {
        if (callback) {
            callback("No server instance exists.");
        }
        return;
    }
    if (callback) {
        callback(null);
    }
};

if (process.env.NODE_ENV === "test") {
    module.exports.app = app;
}
