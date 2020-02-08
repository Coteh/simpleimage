const express = require("express");
const route = require("./routes/route");

var app = express();
var router = express.Router();
var server = null;
var rootDirName = "";

module.exports.setOptions = function(options) {
    rootDirName = options.rootDirName;
};

module.exports.runServer = function(portNumber, callback) {
    server = app.listen(portNumber);

    console.log("Server running at http://localhost:" + portNumber + "/");

    app.use(express.static("public"));
    app.set("view engine", "ejs");

    route(app, router);

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
