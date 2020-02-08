require("dotenv").config();
const databaseOps = require("../database-ops");
const commentUtil = require("../comments");
const util = require("../util");
const multer = require("multer");
const fileType = require("file-type");
const bodyParser = require("body-parser");
const session = require("express-session");
const validator = require("validator");
const owasp = require("owasp-password-strength-test");
const csurf = require("csurf");
const logger = require("../log");
const actionHistory = require("../action-history");
var RedisStore, FileStore;
if (process.env.NODE_ENV === "production"
    || process.env.NODE_ENV === "development") {
    RedisStore = require("connect-redis")(session);
} else {
    FileStore = require("session-file-store")(session);
}

var upload = multer({
    limits: {fileSize: 500000000}
});

module.exports = function(app, router) {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));

    app.set("trust proxy", true);

    if (process.env.NODE_ENV === "production"
        || process.env.NODE_ENV === "development") {
        app.use(session({
            store: new RedisStore({
                url: process.env.REDIS_URL
            }),
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false
        }));
    } else {
        // If running on local machine, use file store sessions instead
        app.use(session({
            store: new FileStore({
                path: "./sessions",
                ttl: 21600
            }),
            secret: "QWERTYUIOP",
            resave: true,
            saveUninitialized: false
        }));
    }

    var csrfProtection = csurf({ cookie: false });

    app.use(csrfProtection);

    app.use((req, res, next) => {
        res.locals.csrfToken = req.csrfToken();
        next();
    });

    function errorHandler(err, req, res, next) {
        logger.writeError("Router has encountered an error: " + (err.stack || "No stack found for this error."));
        var responseType = err.responseType || req.query.type;
        var statusCode = err.statusCode || 500;
        if (responseType === "json") {
            res.status(statusCode).send({
                status: "error",
                message: err.message || "failed",
                additionalInfo: err.additionalInfo
            });
        } else {
            renderError(res, statusCode, err.message, err.additionalInfo);
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
        var errObj = new Error(options.message || err.message || "An unknown error occurred.");
        errObj.statusCode = options.statusCode || 500;
        errObj.responseType = options.responseType;

        // Additional properties added to options besides the ones below (in filteredProps)
        // will be filtered into an "additionalInfo" object to be sent with response.
        var filteredProps = ["message", "statusCode", "responseType"];

        var additionalInfo = Object.keys(options).filter(function(key) {
            return !filteredProps.includes(key);
        }).reduce(function(obj, key) {
            obj[key] = options[key];
            return obj;
        }, {});

        // Only make the additionalInfo object visible in error JSON
        // if there's actually stuff in it.
        if (Object.keys(additionalInfo).length > 0) {
            errObj.additionalInfo = additionalInfo;
        }
        
        next(errObj);
    }

    function handleSession(session, callback) {
        var sessionObj = {};

        if (session.userID !== undefined) {
            databaseOps.findUserByHiddenID(session.userID, function (err, result) {
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

    function renderError(res, statusCode, message, additionalInfo) {
        if (message === undefined) {
            message = "There was an error loading this page. Please try again later.";
        }
        if (statusCode === undefined) {
            statusCode = 500;
        }
        res.status(statusCode);
        res.render("error", {
           message,
           additionalInfo
        });
    }

    router.get(["/", "/index.htm(l|)"], function(req, res, next) {
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
            res.append("Cache-Control", "private, max-age=0, must-revalidate");
            res.render("index", {
                user: sessionObj.user,
                fromUrl: req.url
            });
        });
    });

    router.get("/images/:id.:ext", function(req, res, next) {
        var id = util.getIDFromParam(req.params.id);
        if (id === undefined) {
            routeError(next, {
                message: "Incorrect or malformed image ID."
            });
            return;
        }
        databaseOps.findImage(id, function(err, imageEntry) {
            if (err || imageEntry.length == 0 || (req.params.ext !== undefined && util.extToMimeType(req.params.ext) !== imageEntry[0].mimetype)) {
                routeError(err, next, {
                    message: "Image of this ID does not exist on the database.",
                    statusCode: 404
                });
            } else {
                res.status(200);
                res.append("Cache-Control", "public, max-age=2592000");
                res.type(imageEntry[0].mimetype);
                res.send(imageEntry[0].data.buffer); // Send the file data to the browser.
                logger.writeLog("Served image " + imageEntry[0].id + " by direct link", logger.SeverityLevel.INFO);
            }
        });
    });

    router.get("/images/:id/", function(req, res, next) {
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
                routeError(next, {
                    message: "Incorrect or malformed image ID."
                });
                return;
            }
            databaseOps.findImage(id, function (err, imageEntry) {
                if (err || imageEntry.length == 0) {
                    routeError(err, next, {
                        message: "Image of this ID does not exist on the database.",
                        statusCode: 404
                    });
                } else {
                    res.status(200);
                    res.type("html");
                    res.append("Cache-Control", "private, max-age=0, must-revalidate");
                    res.render("image-view", {
                        id,
                        imageSrc: id + "." + util.mimeTypeToExt(imageEntry[0].mimetype),
                        uploadedDate: imageEntry[0].uploadeddate || "Unknown Date",
                        author: imageEntry[0].username,
                        user: sessionObj.user,
                        fromUrl: req.url
                    });
                    logger.writeLog("Served image " + imageEntry[0].id + " via image page", logger.SeverityLevel.INFO);
                }
            });
        });
    });

    router.get("/users/:username", function(req, res, next) {
        var username = req.params.username;
        if (username === undefined) {
            routeError(next, {
                message: "Username entered is incorrect or malformed."
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

            databaseOps.findUser(username, function (err, result) {
                if (err || result.length === 0) {
                    routeError(err, next, {
                        message: "Could not find user " + username + ".",
                        statusCode: 404
                    });
                    return;
                }

                res.status(200);
                var user = result[0];
                if (req.query.type === "json") {
                    res.send(util.createJSONResponseObject("success", user.username));
                } else { //html
                    res.type("html");
                    res.append("Cache-Control", "private, max-age=0, must-revalidate");
                    res.render("user-view", {
                        user,
                        sessionUser: sessionObj.user,
                        fromUrl: req.url
                    });
                }
                logger.writeLog("Served user page of user " + user.username + ".", logger.SeverityLevel.INFO);
            });
        });
    });

    router.get("/images/:id/comments", function(req, res, next) {
        res.type("html");
        var id = util.getIDFromParam(req.params.id);
        if (id === undefined) {
            routeError(next, {
                message: "Incorrect or malformed image ID."
            });
            return;
        }
        databaseOps.findCommentsForImage(id, function (err, result) {
            if (err) {
                routeError(err, next, {
                    message: "Could not load comments for image of image ID " + id + ".",
                    statusCode: 404
                });
                return;
            }

            res.append("Cache-Control", "private, max-age=0, must-revalidate");
            res.append("Expires", "-1");
            res.append("Pragma", "no-cache");
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

    router.get("/users/:username/comments", function(req, res, next) {
        res.type("html");
        var username = req.params.username;
        if (username === undefined) {
            routeError(next, {
                message: "Username entered is incorrect or malformed."
            });
            return;
        }
        databaseOps.findCommentsForUser(username, function (err, result) {
            if (err) {
                routeError(err, next, {
                    message: "Could not load comments for user " + username + ".",
                    statusCode: 404
                });
                return;
            }

            res.status(200);
            res.append("Cache-Control", "private, max-age=0, must-revalidate");
            res.append("Expires", "-1");
            res.append("Pragma", "no-cache");
            if (result.length === 0) {
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

    router.get("/register", function(req, res, next) {
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

    router.get("/login", function (req, res, next) {
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

    router.post("/upload", function(req, res, next) {
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
                routeError(err, next, {
                    statusCode: 404
                });
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
                    mimetype: req.files[0].mimetype,
                    encoding: req.files[0].encoding,
                    username: username
                };
                var fileTypeData = fileType(imageEntry.data);
                if (fileTypeData == null || !util.isValidImageType(fileTypeData.mime)) {
                    routeError(next, {
                        message: "Image is not a supported file type. Please try again with a supported file type. (" + util.getValidImageTypesString() + ")"
                    });
                    return;
                }
                databaseOps.addImage(imageEntry, function (err, result) {
                    if (result != null) {
                        logger.writeLog("Uploaded image " + result.ops[0].id + " successfully.", logger.SeverityLevel.INFO);
                        actionHistory.writeActionHistory({
                            type: "UPLOAD_IMAGE",
                            item: result.ops[0].id,
                            username,
                            ipAddress: req.ip,
                            info: {
                                request_url: req.url,
                                author: result.ops[0].username
                            }
                        }, function(err, result) {
                            if (err) {
                                console.error(err);
                            }
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

    router.post("/comment", function(req, res, next) {
        if (req.session.userID === undefined) {
            routeError(next, {
                message: "Could not post comment. Currently not logged in."
            });
            return;
        }
        if (req.body.imageID === undefined) {
            routeError(next, {
                message: "Could not post comment. Missing image ID."
            });
            return;
        }
        if (req.body.comment === undefined) {
            routeError(next, {
                message: "Could not post comment. Missing comment."
            });
            return;
        }

        var userHiddenID = req.session.userID;
        
        var imageID = util.getIDFromParam(req.body.imageID);
        if (imageID === undefined) {
            routeError(next, {
                message: "Could not post comment. Invalid image ID."
            });
            return;
        }
        databaseOps.addComment({
                userHiddenID,
                imageID,
                comment: req.body.comment
            }, function(err, result) {
            if (err) {
                routeError(err, next);
                return;
            }
            var comment = result.ops[0];

            logger.writeLog("Comment on image " + imageID + " posted by user " + comment.username + ".", logger.SeverityLevel.INFO);
            actionHistory.writeActionHistory({
                type: "POST_COMMENT",
                item: comment.image_id,
                username: comment.username,
                ipAddress: req.ip,
                info: {
                    request_url: req.url,
                    comment_id: comment._id,
                    comment_text: comment.comment
                }
            }, function (err, result) {
                if (err) {
                    console.error(err);
                }
            });
            
            databaseOps.findUserByHiddenID(userHiddenID, function(err, result) {
                if (err) {
                    routeError(err, next, {
                        message: "Comment has been posted but could not be displayed " +
                                            "at this time. Please refresh the page.",
                        statusCode: 404
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

    router.post("/register", function(req, res, next) {
        if (req.body.username === undefined
            || req.body.username === "") {
            routeError(next, {
                message: "Could not register user. Missing username.",
                field: "username"
            });
            return;
        }
        if (req.body.password === undefined
            || req.body.password === "") {
            routeError(next, {
                message: "Could not register user. Missing password.",
                field: "password"
            });
            return;
        }
        if (req.body.passwordConfirm === undefined
            || req.body.passwordConfirm === "") {
            routeError(next, {
                message: "Could not register user. Missing password confirmation.",
                field: "passwordConfirm"
            });
            return;
        }
        if (req.body.email === undefined
            || req.body.email === "") {
            routeError(next, {
                message: "Could not register user. Missing email.",
                field: "email"
            });
            return;
        }

        if (req.body.password !== req.body.passwordConfirm) {
            routeError(next, {
                message: "Could not register user. Passwords don't match.",
                fields: ["password", "passwordConfirm"]
            });
            return;
        }

        if (!validator.isEmail(req.body.email)) {
            routeError(next, {
                message: "Could not register user. Invalid email.",
                field: "email"
            });
            return;
        }

        var passwordStrengthResult = owasp.test(req.body.password);

        if (!passwordStrengthResult.strong) {
            routeError(next, {
                message: passwordStrengthResult.errors.join("\n"),
                field: "password"
            });
            return;
        }

        var userData = {
            username: req.body.username,
            password: req.body.password,
            email: req.body.email
        };

        databaseOps.addUser(userData, function(err, result) {
            if (err) {
                var field;
                if (err.message !== undefined) {
                    errMsg = err.message;
                } else {
                    if (err.name === "DuplicateField") {
                        if (err.field === "username") {
                            errMsg = "Username already exists.";
                            field = "username";
                        }
                    }
                }
                routeError(err, next, {
                    message: errMsg,
                    field
                });
                return;
            }
            
            req.session.userID = result.insertedId;

            logger.writeLog("User '" + userData.username + "' has been registered.", logger.SeverityLevel.INFO);
            actionHistory.writeActionHistory({
                type: "REGISTER_USER",
                item: userData.username,
                username: userData.username,
                ipAddress: req.ip,
                info: {
                    request_url: req.url
                }
            }, function (err, result) {
                if (err) {
                    console.error(err);
                }
            });

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

    router.post("/login", function(req, res, next) {
        if (req.body.username === "" || req.body.username === undefined) {
            routeError(next, {
                message: "Could not login user. Missing username.",
                field: "username"
            });
            return;
        }
        if (req.body.password === "" || req.body.password === undefined) {
            routeError(next, {
                message: "Could not login user. Missing password.",
                field: "password"
            });
            return;
        }

        var userData = {
            username: req.body.username,
            password: req.body.password
        };

        databaseOps.loginUser(userData, function(err, result) {
            if (err) {
                routeError(err, next, {
                    fields: ["username", "password"]
                });
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

    router.post("/logout", function (req, res, next) {
        req.session.destroy();
        res.redirect(util.getRedirectPath(req.body.redirectUrl));
    });

    router.delete("/images/:id", function (req, res, next) {
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
                    message: "Incorrect or malformed image ID."
                });
                return;
            }
            databaseOps.findImage(id, function (err, imageEntry) {
                if (err || imageEntry.length == 0) {
                    routeError(err, next, {
                        message: "Image of this ID does not exist on the database.",
                        statusCode: 404
                    });
                    return;
                } else {
                    if (imageEntry[0].username !== sessionObj.user.username) {
                        routeError(next, {
                            message: "You are not authorized to delete this image."
                        });
                        return;
                    }
                    databaseOps.deleteImage(id, function(err, result) {
                        if (err) {
                            routeError(err, next);
                            return;
                        }
                        logger.writeLog("Deleted image " + id + ".", logger.SeverityLevel.INFO);
                        actionHistory.writeActionHistory({
                            type: "DELETE_IMAGE",
                            item: id,
                            username: sessionObj.user.username,
                            ipAddress: req.ip,
                            info: {
                                request_url: req.url,
                                author: imageEntry[0].username
                            }
                        }, function (err, result) {
                            if (err) {
                                console.error(err);
                            }
                        })
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
};
