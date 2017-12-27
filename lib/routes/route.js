require('dotenv').config();
const ImageDatabase = require('../ImageDatabase');
const commentUtil = require('../comments');
const util = require('../util');
const multer = require('multer');
const fs = require("fs");
const bodyParser = require("body-parser");
const session = require('express-session');
const validator = require('validator');
const logger = require('../log');
var RedisStore;
if (process.env.NODE_ENV === "prod") {
    RedisStore = require("connect-redis")(session);
}

var upload = multer({
    limits: {fileSize: 500000000}
});

module.exports = function(app, router) {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));

    if (process.env.NODE_ENV === "prod") {
        app.use(session({
            store: new RedisStore({
                host: "si_sessions",
                port: 6379
            }),
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false
        }));
    } else {
        app.use(session({
            secret: "QWERTYUIOP",
            resave: true,
            saveUninitialized: false
        }));
    }

    function errorHandler(err, req, res, next) {
        console.log("An error occurred.");
        console.log(err.stack || "No stack found for this error.");
        var responseType = err.responseType || req.query.type;
        if (responseType === "json") {
            res.status(500).send({
                status: "error",
                message: err.message || "failed"
            });
        } else {
            renderError(res, 500, err.message);
        }
    }

    function routeError(err, next, options) {
        /* Provide an override to call routeError
        without an err object */
        if (typeof err === "function") {
            options = next;
            next = err;
            err = {};
        } else if (err === undefined) {
            err = {};
        }
        if (options === undefined) {
            options = {};
        }
        var err = new Error(options.message || err.message || "An unknown error occurred.");
        err.statusCode = options.statusCode || 500;
        err.responseType = options.responseType;
        next(err);
    }

    function handleSession(session, callback) {
        var sessionObj = {};

        if (session.userID !== undefined) {
            ImageDatabase.findUserByHiddenID(session.userID, function (err, result) {
                if (err) {
                    var type = "";
                    switch (err.name) {
                        case "UserNotFound":
                            type = "userID";
                            break;
                        default:
                            type = "unknown";
                    }
                    callback({
                        type
                    }, null);
                    return;
                }

                var user = result[0];

                user = {
                    username: user.username,
                    email: user.email
                };

                sessionObj.user = user;

                callback(null, sessionObj);
            });
        } else {
            callback(null, sessionObj);
        }
    }

    function renderError(res, statusCode, message) {
        if (message === undefined) {
            message = "There was an error loading this page. Please try again later.";
        }
        if (statusCode === undefined) {
            statusCode = 500;
        }
        res.status(statusCode);
        res.render("error", {
           message
        });
    }

    app.get(["/", "/index.htm(l|)"], function(req, res, next) {
        req.query.type = "html";
        handleSession(req.session, function(err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    sessionObj = {};
                } else {
                    routeError(err, next);
                    return;
                }
            }

            res.status(200);
            res.render("index", {
                user: sessionObj.user,
                fromUrl: req.url
            });
        });
    });

    app.get("/images/:id.:ext", function(req, res, next) {
        var id = parseInt(req.params.id, 10);
        ImageDatabase.findImage(id, function(err, imageEntry) {
            if (err || imageEntry.length == 0 || (req.params.ext !== undefined && util.extToMimeType(req.params.ext) !== imageEntry[0].mimetype)) {
                routeError(err, next, {
                    message: "Image of this ID does not exist on the database."
                });
            } else {
                res.status(200);
                res.type(imageEntry[0].mimetype);
                res.send(imageEntry[0].data.buffer); // Send the file data to the browser.
                logger.writeLog("Served image " + imageEntry[0].id + " by direct link", logger.SeverityLevel.INFO, {
                    fromUrl: req.url
                });
            }
        });
    });

    app.get("/images/:id/", function(req, res, next) {
        if (req.path[req.path.length - 1] === ".") {
            routeError(next, {
                message: "Malformed url."
            });
            return;
        }
        handleSession(req.session, function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    sessionObj = {};
                } else {
                    routeError(err, next);
                    return;
                }
            }

            var id = util.getIDFromParam(req.params.id);
            if (id === undefined) {
                routeError(err, next, {
                    message: "Image of this ID does not exist on the database."
                });
                return;
            }
            ImageDatabase.findImage(id, function (err, imageEntry) {
                if (err || imageEntry.length == 0) {
                    routeError(err, next, {
                        message: "Image of this ID does not exist on the database."
                    });
                } else {
                    res.status(200);
                    res.type("html");
                    res.render("image-view", {
                        id,
                        imageSrc: id + "." + util.mimeTypeToExt(imageEntry[0].mimetype),
                        uploadedDate: imageEntry[0].uploadeddate || "Unknown Date",
                        author: imageEntry[0].username,
                        user: sessionObj.user,
                        fromUrl: req.url
                    });
                    logger.writeLog("Served image " + imageEntry[0].id + " via image page", logger.SeverityLevel.INFO, {
                        sessionUsername: (sessionObj.user !== undefined) ? sessionObj.user.username : "anonymous",
                        fromUrl: req.url
                    });
                }
            });
        });
    });

    app.get("/users/:username", function(req, res, next) {
        var username = req.params.username;
        if (username === undefined) {
            routeError(next, {
                message: "There was a problem taking your request. Please try again later."
            });
            return;
        }
        handleSession(req.session, function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    sessionObj = {};
                } else {
                    routeError(err, next);
                    return;
                }
            }

            ImageDatabase.findUser(username, function (err, result) {
                if (err) {
                    routeError(err, next, {
                        message: "Could not find user " + username + "."
                    });
                    return;
                }

                if (result.length === 0) {
                    routeError(err, next, {
                        message: "Could not find user " + username + "."
                    });
                    return;
                }

                res.status(200);
                var user = result[0];
                if (req.query.type === "json") {
                    res.send(util.createJSONResponseObject("success", user.username));
                } else { //html
                    res.type("html");
                    res.render("user-view", {
                        user,
                        sessionUser: sessionObj.user,
                        fromUrl: req.url
                    });
                }
                logger.writeLog("Served user page of user " + user.username + ".", logger.SeverityLevel.INFO, {
                    sessionUsername: (sessionObj.user !== undefined) ? sessionObj.user.username : "anonymous",
                    fromUrl: req.url
                });
            });
        });
    });

    app.get("/images/:id/comments", function(req, res, next) {
        res.type("html");
        var id = util.getIDFromParam(req.params.id);
        if (id === undefined) {
            routeError(next, {
                message: "Image of this ID does not exist on the database."
            });
            return;
        }
        ImageDatabase.findCommentsForImage(id, function (err, result) {
            if (err) {
                routeError(err, next, {
                    message: "Could not load comments for image of image ID " + id + "."
                });
                return;
            }

            if (result.length === 0) {
                res.status(200);
                if (req.query.type === "html") {
                    res.send("<div id='comments'>There are currently no comments to display.</div>");
                } else { //json
                    res.send({
                        status: "success",
                        message: "There are currently no comments to display."
                    });
                }
                return;
            }

            var comments = [];
            result.forEach(function (comment) {
                var commentInfo = {
                    username: comment.username,
                    imageID: comment.image_id,
                    comment: comment.comment,
                    postedDate: comment.posted_date
                };
                comments.push(commentInfo);
            });

            res.status(200);
            var message;
            if (req.query.type === "html") {
                message = commentUtil.prepareCommentsHTML(comments, "image");
            } else { //json
                message = {
                    status: "success",
                    result_count: result.length,
                    results: commentUtil.prepareComments(comments, req.query.responseType || req.query.type, "image")
                };
            }
            res.send(message);
        });
    });

    app.get("/users/:username/comments", function(req, res, next) {
        res.type("html");
        var username = req.params.username;
        if (username === undefined) {
            routeError(next, {
                message: "User does not exist."
            });
            return;
        }
        ImageDatabase.findCommentsForUser(username, function (err, result) {
            if (err) {
                routeError(err, next, {
                    message: "Could not load comments for user of user ID " + id + "."
                });
                return;
            }

            if (result.length === 0) {
                res.status(200);
                if (req.query.type === "html") {
                    res.send("<div id='comments'>There are currently no comments to display.</div>");
                } else { //json
                    res.send({
                        status: "success",
                        message: "There are currently no comments to display."
                    });
                }
                return;
            }

            var comments = [];

            result.forEach(function (comment) {
                var commentInfo = {
                    username: comment.username,
                    imageID: comment.image_id,
                    comment: comment.comment,
                    postedDate: comment.posted_date
                };
                comments.push(commentInfo);
            });

            res.status(200);
            var message;
            if (req.query.type === "html") {
                message = commentUtil.prepareCommentsHTML(comments, "user");
            } else { //json
                message = {
                    status: "success",
                    result_count: result.length,
                    results: commentUtil.prepareComments(comments, req.query.responseType || req.query.type, "user")
                };
            }
            res.send(message);
        });
    });

    app.get("/register", function(req, res, next) {
        res.render("register-view", {
            fromUrl: req.query.fromUrl || "home",
            responseType: req.query.responseType || "html"
        }, function (err, html) {
            if (err) {
                routeError(err, next, {
                    //message: "Cannot render register page."
                });
            }

            if (req.query.responseType === "json") {
                res.status(200).send({
                    status: "success",
                    html
                });
            } else {
                res.status(200).send(html);
            }
        });
    });

    app.get("/login", function (req, res, next) {
        res.render("login-view", {
            fromUrl: req.query.fromUrl || "home",
            responseType: req.query.responseType || "html"
        }, function(err, html) {
            if (err) {
                routeError(err, next, {
                    //message: "Cannot render login page."
                });
            }

            if (req.query.responseType === "json") {
                res.status(200).send({
                    status: "success",
                    html
                });
            } else {
                res.status(200).send(html);
            }
        });
    });

    app.post("/upload", function(req, res, next) {
        var uploadFunc = upload.any();
        //If user is logged in, upload image under their username
        //Otherwise, upload anonymously
        handleSession(req.session, function(err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    err.message = "There was an error uploading an image under this user. "
                        + "User could not be found. Ensure that user hasn't been deleted and try again.";
                }
                routeError(err, next);
                return;
            }

            var username = (sessionObj.user !== undefined) ? sessionObj.user.username : null;
            
            uploadFunc(req, res, function (err) {
                if (err) {
                    routeError(err, next);
                    return;
                }

                if (req.files.length === 0) {
                    routeError(err, next, {
                        message: "Nothing was selected to upload."
                    });
                    return;
                }
                var imageEntry = {
                    data: req.files[0].buffer,
                    filename: req.files[0].originalname,
                    id: 0,
                    mimetype: req.files[0].mimetype,
                    encoding: req.files[0].encoding,
                    username: username
                }
                ImageDatabase.addImage(imageEntry, function (err, result) {
                    if (result != null) {
                        logger.writeLog("Uploaded image " + result.ops[0].id + " successfully.", logger.SeverityLevel.INFO, {
                            sessionUsername: (sessionObj.user !== undefined) ? sessionObj.user.username : "anonymous"
                        });
                        res.send({
                            status: "success",
                            message: "Image uploaded successfully.",
                            id: result.ops[0].id
                        });
                    } else {
                        routeError(err, next, {
                            message: "Image upload failed."
                        });
                    }
                });
            });
        });
    });

    app.post("/comment", function(req, res, next) {
        if (req.session.userID === undefined) {
            routeError(next, {
                message: "Can not post comment. Currently not logged in."
            });
            return;
        }
        if (req.body.imageID === undefined) {
            routeError(next, {
                message: "Can not post comment. Missing image ID."
            });
            return;
        }
        if (req.body.comment === undefined) {
            routeError(next, {
                message: "Can not post comment. Missing comment."
            });
            return;
        }

        var userHiddenID = req.session.userID;
        
        var imageID = Number(req.body.imageID);
        if (isNaN(imageID)) {
            routeError(next, {
                message: "Can not post comment. Invalid image ID."
            });
            return;
        }
        ImageDatabase.addComment({
                userHiddenID,
                imageID,
                comment: req.body.comment
            }, function(err, result) {
            if (err) {
                routeError(err, next, {
                    message: "Could not post comment."
                });
                return;
            }
            var comment = result.ops[0];

            logger.writeLog("Comment on image " + imageID + " posted by user " + comment.username + ".", logger.SeverityLevel.INFO, {
                sessionUsername: comment.username,
                author: comment.username
            });
            
            ImageDatabase.findUserByHiddenID(userHiddenID, function(err, result) {
                if (err) {
                    routeError(err, next, {
                        message: "Comment has been posted but could not be displayed " +
                                            "at this time. Please refresh the page."
                    });
                    return;
                }
                res.status(200);
                var user = result[0];
                var commentFormatted = {
                    userID: comment.user_id,
                    imageID: comment.image_id,
                    username: user.username,
                    comment: comment.comment,
                    postedDate: comment.posted_date
                };
                var commentText;
                if (req.query.response === "html") {
                    commentText = commentUtil.generateCommentHTML(commentFormatted, "image");
                } else {
                    commentText = commentFormatted;
                }
                res.send({
                    status: "success",
                    message: commentText
                });
            });
        });
    });

    app.post("/register", function(req, res, next) {
        if (req.body.username === undefined
            || req.body.username === "") {
            routeError(next, {
                message: "Can not register user. Missing username."
            });
            return;
        }
        if (req.body.password === undefined
            || req.body.password === "") {
            routeError(next, {
                message: "Can not register user. Missing password."
            });
            return;
        }
        if (req.body.passwordConfirm === undefined
            || req.body.passwordConfirm === "") {
            routeError(next, {
                message: "Can not register user. Missing password confirmation."
            });
            return;
        }
        if (req.body.email === undefined
            || req.body.email === "") {
            routeError(next, {
                message: "Can not register user. Missing email."
            });
            return;
        }

        if (req.body.password !== req.body.passwordConfirm) {
            routeError(next, {
                message: "Can not register user. Passwords don't match."
            });
            return;
        }

        if (!validator.isEmail(req.body.email)) {
            routeError(next, {
                message: "Can not register user. Invalid email."
            });
            return;
        }

        var userData = {
            username: req.body.username,
            password: req.body.password,
            email: req.body.email
        };

        ImageDatabase.addUser(userData, function(err, result) {
            if (err) {
                if (err.message !== undefined) {
                    errMsg = err.message;
                } else {
                    if (err.name === "DuplicateField") {
                        if (err.field === "username") {
                            errMsg = "Username already exists.";
                        }
                    }
                }
                routeError(err, next, {
                    message: errMsg
                });
                return;
            }
            req.session.userID = result.insertedId;
            if (req.query.type === "json") {
                res.status(200).send({
                    status: "success",
                    message: "User registered."
                });
            } else {
                res.redirect(util.getRedirectPath(req.body.redirectUrl));
            }
        });
    });

    app.post("/login", function(req, res, next) {
        if (req.body.username === "" || req.body.username === undefined) {
            routeError(next, {
                message: "Can not login user. Missing username."
            });
            return;
        }
        if (req.body.password === "" || req.body.password === undefined) {
            routeError(next, {
                message: "Can not login user. Missing password."
            });
            return;
        }

        var userData = {
            username: req.body.username,
            password: req.body.password
        };

        ImageDatabase.loginUser(userData, function(err, result) {
            if (err) {
                routeError(err, next);
                return;
            }
            req.session.userID = result.user._id;
            if (req.query.type === "json") {
                res.status(200);
                res.send({
                    status: "success",
                    message: result.message
                });
            } else {
                res.redirect(util.getRedirectPath(req.body.redirectUrl));
            }
        });
    });

    app.post("/logout", function (req, res, next) {
        req.session.destroy();
        res.redirect(util.getRedirectPath(req.body.redirectUrl));
    });

    app.delete("/images/:id", function (req, res, next) {
        handleSession(req.session, function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    sessionObj = {};
                } else {
                    routeError(err, next);
                    return;
                }
            }

            if (sessionObj.user === undefined) {
                routeError(next, {
                    message: "You need to be logged in to perform this action."
                });
                return;
            }

            var id = util.getIDFromParam(req.params.id);
            if (id === undefined) {
                routeError(err, next, {
                    message: "Image of this ID does not exist on the database."
                });
                return;
            }
            ImageDatabase.findImage(id, function (err, imageEntry) {
                if (err || imageEntry.length == 0) {
                    routeError(err, next, {
                        message: "Image of this ID does not exist on the database."
                    });
                    return;
                } else {
                    if (imageEntry[0].username !== sessionObj.user.username) {
                        routeError(next, {
                            message: "You are not authorized to delete this image."
                        });
                        return;
                    }
                    ImageDatabase.deleteImage(id, function(err, result) {
                        if (err) {
                            routeError(err, next);
                            return;
                        }
                        logger.writeLog("Deleted image " + id + ".", logger.SeverityLevel.INFO, {
                            sessionUsername: (sessionObj.user !== undefined) ? sessionObj.user.username : "anonymous",
                        });
                        res.status(200);
                        res.send({
                            status: "success",
                            message: "Image of ID " + id + " deleted successfully."
                        });
                    });
                }
            });
        });
    });

    app.use("/", router);
    app.use(errorHandler);
}
