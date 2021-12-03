require("dotenv").config();
const databaseOps = require("../database-ops");
const commentUtil = require("../comments");
const util = require("../util");
const userUtil = require("../user-util");
const passwordUtil = require('../util/password');
const usernameUtil = require("../util/username");
const multer = require("multer");
const fileType = require("file-type");
const bodyParser = require("body-parser");
const session = require("express-session");
const validator = require("validator");
const csurf = require("csurf");
const RateLimit = require("express-rate-limit");
const logger = require("../logger").logger;
const actionHistory = require("../action-history");
const auth = require("../auth");
var RedisStore, FileStore, RateLimitRedisStore;
if (process.env.NODE_ENV === "production"
    || process.env.NODE_ENV === "development") {
    RedisStore = require("connect-redis")(session);
    RateLimitRedisStore = require("rate-limit-redis");
} else {
    FileStore = require("session-file-store")(session);
}
const fs = require("fs");

var upload = multer({
    limits: {fileSize: 500000000}
});

module.exports = function(app, router) {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.set("trust proxy", 1);

    let imgDoesNotExist;
    try {
        imgDoesNotExist = fs.readFileSync("./img/ImageDoesNotExist.png");
    } catch (e) {
        throw new Error(`Could not load placeholder image: ${e}`);
    }

    if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
        throw new Error("Must provide a secret for sessions");
    }
    const sessionSecret = process.env.SESSION_SECRET || "mysecret";

    if (process.env.NODE_ENV === "production"
    || process.env.NODE_ENV === "development") {
        app.use(session({
            store: new RedisStore({
                url: process.env.REDIS_URL
            }),
            secret: sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: (process.env.NODE_ENV === "production" || (process.env.NODE_ENV === "development" && process.env.USE_DEV_HTTPS === 'true')),
            },
        }));
    } else {
        // If running on local machine, use file store sessions instead
        app.use(session({
            store: (process.env.NODE_ENV !== "test") ? new FileStore({
                path: "./sessions",
                ttl: 21600
            }) : undefined,
            secret: sessionSecret,
            resave: true,
            saveUninitialized: false
        }));
    }

    const format = (format) => {
        return (req, res, next) => {
            req.format = format;
            next();
        };
    }

    var uploadLimiter, commentsLimiter, authLimiter, limiter;
    var uploadLimitSeconds = 60 * 60; // 1 hour window
    var commentsLimitSeconds = 60 * 60; // 1 hour window
    var authLimitSeconds = 60 * 60; // 1 hour window
    var requestLimitSeconds = 60 * 60; // 1 hour window

    var createLimitKeyFunc = (id) => {
        return (req) => {
            return req.ip + ":" + id;
        };
    };

    var createLimitHandler = (options) => {
        return (req, res, next) => {
            sendError(next, options);
        };
    };

    var createRateLimitStore = (options) => {
        if (!(process.env.NODE_ENV === "production"
            || process.env.NODE_ENV === "development")) {
                // use express-rate-limit's memory store by giving it undefined
                return undefined;
            }
        return new RateLimitRedisStore(Object.assign({
            redisURL: process.env.REDIS_URL
        }, options));
    };

    if (process.env.NODE_ENV !== "test") {
        var uploadLimiter = new RateLimit({
            store: createRateLimitStore({
                expiry: uploadLimitSeconds
            }),
            windowMs: uploadLimitSeconds * 1000,
            max: 10,
            keyGenerator: createLimitKeyFunc("uploads"),
            handler: createLimitHandler({
                statusCode: 429,
                message: "Upload rate limit has been reached. Try again later."
            })
        });
        
        var commentsLimiter = new RateLimit({
            store: createRateLimitStore({
                expiry: commentsLimitSeconds
            }),
            windowMs: commentsLimitSeconds * 1000,
            max: 25,
            keyGenerator: createLimitKeyFunc("comments"),
            handler: createLimitHandler({
                statusCode: 429,
                message: "Comment rate limit has been reached. Try again later."
            })
        });

        var authLimiter = new RateLimit({
            store: createRateLimitStore({
                expiry: authLimitSeconds
            }),
            windowMs: authLimitSeconds * 1000,
            max: 10,
            keyGenerator: createLimitKeyFunc("auth"),
            handler: createLimitHandler({
                statusCode: 429,
                message: "Too many login attempts. Try again later."
            })
        });
        
        var limiter = new RateLimit({
            store: createRateLimitStore({
                expiry: requestLimitSeconds
            }),
            windowMs: requestLimitSeconds * 1000,
            max: 100,
            keyGenerator: createLimitKeyFunc("requests"),
            handler: createLimitHandler({
                statusCode: 429,
                message: "Request rate limit has been reached. Try again later."
            })
        });
    } else {
        var dummyRateLimiter = (req, res, next) => {
            next();
        };

        uploadLimiter = dummyRateLimiter;
        commentsLimiter = dummyRateLimiter;
        authLimiter = dummyRateLimiter;
        limiter = dummyRateLimiter;
    }
    
    var csurfOptions = { cookie: false };
    if (process.env.NODE_ENV !== "production") {
        csurfOptions.ignoreMethods = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"];
    }

    var csrfProtection = csurf(csurfOptions);

    app.use(csrfProtection);

    app.use((req, res, next) => {
        res.locals.csrfToken = req.csrfToken();
        next();
    });

    function errorHandler(err, req, res, next) {
        logger.error("Router has encountered an error: " + (err.stack || "No stack found for this error."));
        const statusCode = err.statusCode || 500;
        switch (req.format) {
            case "html":
                renderError(res, statusCode, err.message, err.errorID, err.additionalInfo);
                break;
            case "html-minimal":
                res.status(statusCode).send(`<div><span id="err-message">${err.message}</span>${err.errorID ? `<br/><span><b>Error ID:</b> <span id="err-id">${err.errorID}</span></span></div>` : ""}`);
                break;
            default: //json
                res.status(statusCode).send({
                    status: "error",
                    message: err.message || "failed",
                    errorID: err.errorID,
                    additionalInfo: err.additionalInfo
                });
                break;
        }
    }

    function sendError(err, next, options) {
        // Override to call this function without an err object
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
        errObj.errorID = options.errorID;

        // Additional properties added to options besides the ones below (in filteredProps)
        // will be filtered into an "additionalInfo" object to be sent with response.
        var filteredProps = ["message", "statusCode", "errorID"];

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

    function sendSuccess(res, message, data) {
        res.send({
            status: "success",
            message,
            ...data,
        });
    }

    // TODO convert to express middleware
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
                    return callback({
                        type
                    }, null);
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
            sessionObj.guest = true;
            callback(null, sessionObj);
        }
    }

    function renderError(res, statusCode, message, errorID, additionalInfo) {
        if (message === undefined) {
            message = "There was an error loading this page. Please try again later.";
        }
        if (statusCode === undefined) {
            statusCode = 500;
        }
        res.status(statusCode);
        res.render("error", {
           message,
           errorID,
           additionalInfo
        });
    }

    router.get(["/", "/index.htm(l|)"], format("html"), function(req, res, next) {
        handleSession(req.session, function(err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    sessionObj = {};
                } else {
                    return sendError(err, next);
                }
            }

            res.status(200);
            res.append("Cache-Control", "private, max-age=0, must-revalidate");
            res.render("index", {
                user: sessionObj.user
            });
        });
    });

    router.get("/images/:id.:ext", function(req, res, next) {
        var id = util.getIDFromParam(req.params.id);
        if (id === undefined || id === "removed") {
            // return placeholder image
            res.status(200);
            res.append("Cache-Control", "public, max-age=2592000");
            res.type("image/png");
            res.send(imgDoesNotExist); // Send the file data to the browser.
            return logger.info("Served 'removed' placeholder image by direct link");
        }
        databaseOps.findImage(id, function(err, imageEntry) {
            if (err) {
                logger.error("Error finding image from database", err);
                return sendError(err, next, {
                    message: "Error finding image. Please try again later.",
                    statusCode: 500
                });
            }
            if (imageEntry.length == 0 || (req.params.ext !== undefined && util.extToMimeType(req.params.ext) !== imageEntry[0].mimetype)) {
                logger.error(`Could not find image of ID ${id} for direct link, serving "removed" placeholder image via redirect`);
                res.redirect("/images/removed.png");
            } else {
                res.status(200);
                res.append("Cache-Control", "public, max-age=2592000");
                res.type(imageEntry[0].mimetype);
                res.send(imageEntry[0].data.buffer); // Send the file data to the browser.
                logger.info("Served image " + imageEntry[0].id + " by direct link");
            }
        });
    });

    router.get("/images/:id", format("html"), function(req, res, next) {
        if (req.path[req.path.length - 1] === ".") {
            return sendError(next, {
                message: "Malformed url."
            });
        }
        handleSession(req.session, function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    sessionObj = {};
                } else {
                    return sendError(err, next);
                }
            }

            var id = util.getIDFromParam(req.params.id);
            if (id === undefined) {
                return sendError(next, {
                    message: "Incorrect or malformed image ID."
                });
            }
            databaseOps.findImage(id, function (err, imageEntry) {
                if (err || imageEntry.length == 0) {
                    sendError(err, next, {
                        message: "Image of this ID does not exist on the database.",
                        statusCode: 404
                    });
                } else {
                    res.status(200);
                    res.append("Cache-Control", "private, max-age=0, must-revalidate");
                    res.render("image-view", {
                        id,
                        imageSrc: id + "." + util.mimeTypeToExt(imageEntry[0].mimetype),
                        uploadedDate: imageEntry[0].uploadeddate || "Unknown Date",
                        author: imageEntry[0].username,
                        user: sessionObj.user
                    });
                    logger.info("Served image " + imageEntry[0].id + " via image page");
                }
            });
        });
    });

    router.get("/users/:username", format("html"), function(req, res, next) {
        var username = req.params.username;
        if (username === undefined) {
            return sendError(next, {
                message: "Username entered is incorrect or malformed."
            });
        }
        handleSession(req.session, function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    sessionObj = {};
                } else {
                    return sendError(err, next);
                }
            }

            databaseOps.findUser(username, function (err, result) {
                if (err || result.length === 0) {
                    return sendError(err, next, {
                        message: "Could not find user " + username + ".",
                        statusCode: 404
                    });
                }

                res.status(200);
                var user = result[0];
                res.append("Cache-Control", "private, max-age=0, must-revalidate");
                res.render("user-view", {
                    user,
                    sessionUser: sessionObj.user
                });
                logger.info("Served user page of user " + user.username + ".");
            });
        });
    });

    router.get("/settings", format("html"), function(req, res, next) {
        handleSession(req.session, function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    // TODO:#265 Prevent settings page from being accessible by non-users (ie. guests)
                    req.session.userID = undefined;
                    sessionObj = {};
                } else {
                    return sendError(err, next);
                }
            }

            res.render("settings-view", {
                sessionUser: sessionObj.user,
            });
        });
    });

    router.get("/images/:id/comments", format("json"), function(req, res, next) {
        var id = util.getIDFromParam(req.params.id);
        if (id === undefined) {
            return sendError(next, {
                message: "Incorrect or malformed image ID.",
            });
        }
        databaseOps.findCommentsForImage(id, function (err, result) {
            if (err) {
                return sendError(err, next, {
                    errorID: "imageCommentsError",
                    message: "Could not load comments for image of image ID " + id + ".",
                    statusCode: 500,
                });
            }

            res.status(200);
            res.append("Cache-Control", "private, max-age=0, must-revalidate");
            res.append("Expires", "-1");
            res.append("Pragma", "no-cache");

            if (result.length === 0) {
                return sendSuccess(res, "There are currently no comments to display.", {
                    data: [],
                });
            }

            const comments = result.map(comment => ({
                username: comment.username,
                imageID: comment.image_id,
                comment: comment.comment,
                postedDate: comment.posted_date,
            }));

            sendSuccess(res, "", {
                data: comments.map(comment => commentUtil.createCommentResponseObject(comment)),
            });
        });
    });

    router.get("/users/:username/comments", format("json"), function(req, res, next) {
        var username = req.params.username;
        if (username === undefined) {
            return sendError(next, {
                message: "Username entered is incorrect or malformed.",
            });
        }
        databaseOps.findCommentsForUser(username, function (err, result) {
            if (err) {
                return sendError(err, next, {
                    errorID: "userCommentsError",
                    message: "Could not load comments for user " + username + ".",
                    statusCode: 500
                });
            }

            res.status(200);
            res.append("Cache-Control", "private, max-age=0, must-revalidate");
            res.append("Expires", "-1");
            res.append("Pragma", "no-cache");

            if (result.length === 0) {
                return sendSuccess(res, "There are currently no comments to display.", {
                    data: [],
                });
            }

            const comments = result.map(comment => ({
                username: comment.username,
                imageID: comment.image_id,
                comment: comment.comment,
                postedDate: comment.posted_date
            }));

            const promises = comments.map(comment => new Promise((resolve, reject) => {
                databaseOps.findImageAttributes(comment.imageID, (err, results) => {
                    if (err) {
                        logger.error(`Could not find attributes for image of ID ${comment.imageID} for user comments page, err: `, err);
                        return reject(err);
                    }
                    resolve(results);
                });
            }));
            Promise.allSettled(promises)
                .then(results => {
                    if (results.some(result => result.status === "rejected")) {
                        return sendError(err, next, {
                            message: "Could not load comments for user " + username + ".",
                            errorID: "imageAttribsError",
                            statusCode: 500
                        });
                    }
                    const images = results.reduce((dict, result) => {
                        if (result.status === "fulfilled" && result.value.length > 0) {
                            dict[result.value[0].id] = result.value[0];
                        }
                        return dict;
                    }, {});
                    sendSuccess(res, "", {
                        data: comments.map(comment => commentUtil.createCommentResponseObject(comment, images[comment.imageID])),
                    });
                });
        });
    });

    router.get("/users/:username/images", format("json"), function(req, res, next) {
        var username = req.params.username;
        if (username === undefined) {
            return sendError(next, {
                message: "Username entered is incorrect or malformed."
            });
        }

        databaseOps.findImagesForUser(username, function(err, images) {
            if (err) {
                if (err instanceof databaseOps.UserNotFoundError) {
                    return sendError(next, {
                        errorID: "userNotFound",
                        message: "Could not find user " + username + ".",
                        statusCode: 404
                    });
                } else {
                    return sendError(err, next, {
                        errorID: "userImagesError",
                        message: "Could not load images for user " + username + ".",
                        statusCode: 500
                    });
                }
            }
            
            res.status(200);
            sendSuccess(res, "", {
                data: images.map((image) => userUtil.createUserImageResponseObject(image)),
            });
        });
    });

    router.get("/register", format("html-minimal"), function(req, res, next) {
        res.render("register-view", function (err, html) {
            if (err) {
                return sendError(err, next, {
                    message: "Cannot render register page."
                });
            }

            res.status(200).send(html);
        });
    });

    router.get("/user", format("json"), function (req, res, next) {
        handleSession(req.session, function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    return sendError(err, next, {
                        errorID: "sessionUserNotFound",
                        message: "Cannot retrieve status. User no longer exists.",
                        statusCode: 404,
                    });
                } else {
                    return sendError(err, next);
                }
            }
            if (sessionObj.guest) {
                return sendError(err, next, {
                    errorID: "notSignedIn",
                    message: "Cannot retrieve status. Not signed in.",
                    statusCode: 400,
                });
            }
            else {
                res.status(200);
                sendSuccess(res, "User logged in");
            }
        })
    })

    router.get("/check_username", format("json"), limiter, function(req, res, next) {
        let username = req.query.username;
        if (!username) {
            // TODO make the ordering of properties consistent for all error responses
            return sendError(next, {
                message: "No username to check.",
                errorID: "noUsernameToCheck",
                statusCode: 400,
            });
        }
        if (typeof username !== "string") {
            if (Array.isArray(username)) {
                username = username[0];
            } else {
                return sendError(next, {
                    message: "Invalid username specified.",
                    errorID: "invalidUsernameToCheck",
                    statusCode: 400,
                });
            }
        }
        const usernameCheckResult = usernameUtil.isValidUsername(username);
        if (!usernameCheckResult.valid) {
            let errorID;
            let message;
            switch (usernameCheckResult.error) {
                case usernameUtil.UsernameError.USERNAME_TOO_LONG:
                    errorID = "usernameTooLong";
                    message = "Username contains too many characters.";
                    break;
                default:
                    errorID = "usernameUnknownError";
                    message = "Unknown error. Try again later.";
            }
            return sendError(next, {
                message,
                errorID,
                statusCode: 400,
            });
        }
        logger.info("Checking for existence of user " + username + ".");
        databaseOps.findUser(username, function (err, result) {
            if (err) {
                if (err.message === "Invalid username") {
                    return sendError(err, next, {
                        message: "Error checking user",
                        errorID: "errorCheckingUser",
                        statusCode: 400,
                    });    
                }
                return sendError(err, next, {
                    message: "Error checking user",
                    errorID: "errorCheckingUser",
                    statusCode: 500,
                });
            }

            const exists = result.length > 0;
            logger.info("User " + username + (exists ? " exists." : " does not exist."));
            res.status(200);
            sendSuccess(res, "", {
                exists,
            });
        });
    });

    router.get("/login", format("html-minimal"), function (req, res, next) {
        res.render("login-view", function(err, html) {
            if (err) {
                return sendError(err, next, {
                    message: "Cannot render login page.",
                });
            }

            res.status(200).send(html);
        });
    });

    router.post("/upload", format("json"), uploadLimiter, function(req, res, next) {
        var uploadFunc = upload.any();
        //If user is logged in, upload image under their username
        //Otherwise, upload anonymously
        handleSession(req.session, function(err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    err.message = "There was an error uploading an image under this user. "
                    + "User could not be found. Ensure that user hasn't been deleted and try again.";
                    return sendError(err, next, {
                        errorID: "sessionUserNotFound",
                        statusCode: 404,
                    });
                } else {
                    return sendError(err, next);
                }
            }

            if (sessionObj.guest && process.env.LOGIN_TO_UPLOAD === "true") {
                return sendError(next, {
                    errorID: "notSignedIn",
                    message: "Cannot perform action. Not signed in.",
                    statusCode: 401,
                });
            }
            
            var username = (sessionObj.user !== undefined) ? sessionObj.user.username : null;
            
            uploadFunc(req, res, function (err) {
                if (err) {
                    return sendError(err, next);
                }

                if (!req.files || req.files.length === 0) {
                    return sendError(err, next, {
                        errorID: "noFilesSelected",
                        message: "Nothing was selected to upload.",
                        statusCode: 400,
                    });
                }
                var imageEntry = {
                    data: req.files[0].buffer,
                    mimetype: req.files[0].mimetype,
                    encoding: req.files[0].encoding,
                    username: username
                };
                var fileTypeData = fileType(imageEntry.data);
                if (fileTypeData == null || !util.isValidImageType(fileTypeData.mime)) {
                    return sendError(next, {
                        errorID: "invalidFileType",
                        message: "Image is not a supported file type. Please try again with a supported file type. (" + util.getValidImageTypesString() + ")",
                        statusCode: 400,
                    });
                }
                databaseOps.addImage(imageEntry, function (err, result) {
                    if (result != null) {
                        logger.info("Uploaded image " + result.ops[0].id + " successfully.");
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
                                logger.error(err);
                            }
                        });
                        sendSuccess(res, "Image uploaded successfully.", {
                            id: result.ops[0].id,
                        });
                    } else {
                        sendError(err, next, {
                            message: "Image upload failed."
                        });
                    }
                });
            });
        });
    });

    router.post("/comment", format("json"), commentsLimiter, function(req, res, next) {
        handleSession(req.session, async function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    err.message = "There was an error posting comment. "
                        + "User could not be found. Ensure that user hasn't been deleted and try again.";
                }
                return sendError(err, next, {
                    errorID: "sessionUserNotFound",
                    statusCode: 404,
                });
            }

            if (sessionObj.guest) {
                return sendError(next, {
                    statusCode: 401,
                    message: "Cannot perform action. Not signed in.",
                    errorID: "notSignedIn",
                });
            }
        
            if (req.body.imageID === undefined) {
                return sendError(next, {
                    statusCode: 400,
                    message: "Could not post comment. Missing image ID.",
                    errorID: "missingImageID",
                });
            }
            if (req.body.comment === undefined) {
                return sendError(next, {
                    statusCode: 400,
                    message: "Could not post comment. Missing comment.",
                    errorID: "missingComment",
                });
            }

            var userHiddenID = req.session.userID;
            
            var imageID = util.getIDFromParam(req.body.imageID);
            if (imageID === undefined) {
                return sendError(next, {
                    statusCode: 400,
                    message: "Could not post comment. Invalid image ID.",
                    errorID: "invalidImageID",
                });
            }

            databaseOps.findImage(imageID, function (err, imageEntry) {
                if (err || imageEntry.length == 0) {
                    return sendError(err, next, {
                        statusCode: 404,
                        message: "Image of this ID does not exist on the database.",
                        errorID: "imageNotFound",
                    });
                }
                databaseOps.addComment({
                    userHiddenID,
                    imageID,
                    comment: req.body.comment
                }, function(err, result) {
                    if (err) {
                        return sendError(err, next, {
                            errorID: "databaseError",
                        });
                    }
                    var comment = result.ops[0];

                    logger.info("Comment on image " + imageID + " posted by user " + comment.username + ".");
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
                            logger.error(err);
                        }
                    });
                    
                    res.status(200);
                    sendSuccess(res, '', {
                        comment: {
                            userID: comment.user_id,
                            imageID: comment.image_id,
                            username: util.escapeOutput(comment.username),
                            comment: util.escapeOutput(comment.comment),
                            postedDate: comment.posted_date,
                        },
                    });
                });
            });
        });
    });

    router.post("/register", format("json"), limiter, function(req, res, next) {
        if (req.body.username === undefined
            || req.body.username === "") {
            return sendError(next, {
                statusCode: 422,
                message: "Could not register user. Missing username.",
                errorID: "usernameEmpty",
                field: "username"
            });
        }
        if (req.body.password === undefined
            || req.body.password === "") {
            return sendError(next, {
                statusCode: 422,
                message: "Could not register user. Missing password.",
                errorID: "passwordEmpty",
                field: "password"
            });
        }
        if (req.body.passwordConfirm === undefined
            || req.body.passwordConfirm === "") {
            return sendError(next, {
                statusCode: 422,
                message: "Could not register user. Missing password confirmation.",
                errorID: "passwordConfirmEmpty",
                field: "passwordConfirm"
            });
        }
        if (req.body.email === undefined
            || req.body.email === "") {
            return sendError(next, {
                statusCode: 422,
                message: "Could not register user. Missing email.",
                errorID: "emailEmpty",
                field: "email"
            });
        }

        if (req.body.password !== req.body.passwordConfirm) {
            return sendError(next, {
                statusCode: 400,
                errorID: "passwordMismatch",
                message: "Could not register user. Passwords don't match.",
                fields: ["password", "passwordConfirm"]
            });
        }

        if (!validator.isEmail(req.body.email)) {
            return sendError(next, {
                statusCode: 400,
                message: "Could not register user. Invalid email.",
                errorID: "emailInvalid",
                field: "email"
            });
        }

        const usernameCheckResult = usernameUtil.isValidUsername(req.body.username);
        if (!usernameCheckResult.valid) {
            switch (usernameCheckResult.error) {
                case usernameUtil.UsernameError.USERNAME_TOO_LONG:
                    logger.error(`Could not register user ${req.body.username}. Username contains too many characters.`);
                    sendError(next, {
                        statusCode: 400,
                        message: "Could not register user. Username contains too many characters.",
                        errorID: "usernameTooLong",
                        field: "username",
                    });
                    break;
                default:
                    logger.error(`Could not register user ${req.body.username}. Unknown error with username check.`);
                    sendError(next, {
                        statusCode: 400,
                        message: "Could not register user. Unknown error.",
                        errorID: "usernameUnknownError",
                    });
            }
            return;
        }

        const passwordStrengthResult = passwordUtil.verifyPasswordStrength(req.body.password);
        if (!passwordStrengthResult.strong) {
            return sendError(next, {
                statusCode: 400,
                message: passwordStrengthResult.errors.join("\n"),
                errorID: "weakPassword",
                field: "password"
            });
        }

        var userData = {
            username: req.body.username,
            password: req.body.password,
            email: req.body.email
        };

        databaseOps.addUser(userData, function(err, result) {
            if (err) {
                let field;
                let statusCode = 500;
                let errorID = "databaseError";
                if (err.message !== undefined) {
                    errMsg = err.message;
                } else {
                    if (err.name === "DuplicateField") {
                        if (err.field === "username") {
                            errMsg = "Username already exists.";
                            field = "username";
                            statusCode = 400;
                            errorID = "usernameTaken";
                        }
                    }
                }
                return sendError(err, next, {
                    statusCode,
                    message: errMsg,
                    errorID,
                    field
                });
            }
            
            req.session.userID = result.insertedId;

            logger.info("User '" + userData.username + "' has been registered.");
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
                    logger.error(err);
                }
            });

            res.status(200);
            sendSuccess(res, "User registered.");
        });
    });

    router.post("/login", format("json"), authLimiter, function(req, res, next) {
        if (req.body.username === "" || req.body.username === undefined) {
            return sendError(next, {
                statusCode: 400,
                message: "Could not login user. Missing username.",
                errorID: "missingUsername",
                field: "username"
            });
        }
        if (req.body.password === "" || req.body.password === undefined) {
            return sendError(next, {
                statusCode: 400,
                message: "Could not login user. Missing password.",
                errorID: "missingPassword",
                field: "password"
            });
        }

        var userData = {
            username: req.body.username,
            password: req.body.password
        };

        databaseOps.loginUser(userData, function(err, result) {
            if (err) {
                return sendError(err, next, {
                    errorID: (err instanceof databaseOps.UserPassComboNotFoundError) ? "userPassComboNotFound" : "loginUserDatabaseError",
                    statusCode: (err instanceof databaseOps.UserPassComboNotFoundError) ? 401 : 500,
                    fields: ["username", "password"]
                });
            }
            req.session.userID = result.user._id;
            res.status(200);
            sendSuccess(res, result.message, {
                username: util.escapeOutput(result.user.username),
            });
        });
    });

    router.post("/change_password", format("json"), limiter, function (req, res, next) {
        handleSession(req.session, async function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    err.message = "There was an error changing password for this user. "
                        + "User could not be found. Ensure that user hasn't been deleted and try again.";
                }
                return sendError(err, next, {
                    errorID: "sessionUserNotFound",
                    statusCode: 404
                });
            }

            if (sessionObj.guest) {
                var err = {
                    message: "Cannot perform action. Not signed in."
                };
                return sendError(err, next, {
                    errorID: "notSignedIn",
                    statusCode: 400
                });
            }

            var userData = sessionObj.user;

            if (req.body.oldPassword === undefined
                || req.body.oldPassword === "") {
                return sendError(next, {
                    errorID: "missingOldPassword",
                    message: "Could not change password. Missing old password.",
                    field: "oldPassword",
                    statusCode: 400
                });
            }
            if (req.body.newPassword === undefined
                || req.body.newPassword === "") {
                return sendError(next, {
                    errorID: "missingNewPassword",
                    message: "Could not change password. Missing new password.",
                    field: "newPassword",
                    statusCode: 400
                });
            }
            if (req.body.newPasswordConfirm === undefined
                || req.body.newPasswordConfirm === "") {
                return sendError(next, {
                    errorID: "missingNewPasswordConfirm",
                    message: "Could not change password. Missing new password confirmation.",
                    field: "newPasswordConfirm",
                    statusCode: 400
                });
            }

            databaseOps.findUser(userData.username, async function (err, results) {
                if (err || results.length === 0) {
                    if (err) {
                        logger.error(err.stack);
                    } else {
                        logger.error("Could not find user '" + userData.username + "' in database");
                    }
                    return sendError(next, {
                        errorID: "userNotFound",
                        message: "Could not change password. Could not find user in database."
                    });
                }

                var user = results[0];

                var result = false;
                try {
                    result = await auth.authenticateUser(user, req.body.oldPassword);
                } catch (e) {
                    logger.error("Error authenticating old password of user", e);
                }

                if (!result) {
                    return sendError(next, {
                        errorID: "oldPasswordIncorrect",
                        message: "Could not change password. Old password is not correct.",
                        field: "oldPassword",
                        statusCode: 400
                    });
                }

                if (req.body.newPassword !== req.body.newPasswordConfirm) {
                    return sendError(next, {
                        errorID: "passwordsDoNotMatch",
                        message: "Could not change password. Passwords don't match.",
                        fields: ["newPassword", "newPasswordConfirm"],
                        statusCode: 400
                    });
                }

                if (req.body.newPassword === req.body.oldPassword) {
                    return sendError(next, {
                        errorID: "passwordSame",
                        message: "Could not change password. New password is the same as the old password.",
                        fields: ["oldPassword", "newPassword", "newPasswordConfirm"],
                        statusCode: 400
                    });
                }

                let passwordStrengthResult = passwordUtil.verifyPasswordStrength(req.body.newPassword);

                if (!passwordStrengthResult.strong) {
                    return sendError(next, {
                        errorID: "passwordNotStrong",
                        message: passwordStrengthResult.errors.join("\n"),
                        field: "newPassword",
                        statusCode: 400
                    });
                }

                databaseOps.changeUserPassword(user._id, req.body.newPassword)
                    .then((result) => {
                        logger.info("User '" + userData.username + "' password has been changed.");
                        actionHistory.writeActionHistory({
                            type: "USER_CHANGE_PASSWORD",
                            item: userData.username,
                            username: userData.username,
                            ipAddress: req.ip,
                            info: {
                                request_url: req.url
                            }
                        }, function (err, result) {
                            if (err) {
                                logger.error(err);
                            }
                        });

                        res.status(200);
                        sendSuccess(res, "Password changed.");
                    })
                    .catch((err) => {
                        sendError(next, {
                            errorID: "errorChangingPassword",
                            message: err.message,
                            fields: ["newPassword", "newPasswordConfirm"],
                            statusCode: 500
                        });
                    });
            });
        });
    });

    router.post("/logout", limiter, function (req, res, next) {
        req.session.destroy();
        var referrer = req.header("Referer");
        if (referrer && referrer.indexOf("/settings") >= 0) {
            res.redirect(util.getRedirectPath("/"));
        } else {
            res.redirect(util.getRedirectPath(referrer));
        }
    });

    router.delete("/images/:id", format("json"), limiter, function (req, res, next) {
        handleSession(req.session, function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    err.message = "There was an error deleting image. "
                        + "User could not be found. Ensure that user hasn't been deleted and try again.";
                    return sendError(err, next, {
                        errorID: "sessionUserNotFound",
                        statusCode: 404
                    });
                } else {
                    return sendError(err, next);
                }
            }

            if (sessionObj.user === undefined) {
                return sendError(next, {
                    statusCode: 401,
                    message: "You need to be logged in to perform this action.",
                    errorID: "notLoggedIn",
                });
            }

            var id = util.getIDFromParam(req.params.id);
            if (id === undefined) {
                return sendError(err, next, {
                    statusCode: 400,
                    message: "Incorrect or malformed image ID.",
                    errorID: "invalidImageID",
                });
            }
            databaseOps.findImage(id, function (err, imageEntry) {
                if (err || imageEntry.length == 0) {
                    return sendError(err, next, {
                        statusCode: 404,
                        message: "Image of this ID does not exist on the database.",
                        errorID: "imageNotFound",
                    });
                }
                if (imageEntry[0].username !== sessionObj.user.username) {
                    return sendError(next, {
                        statusCode: 403,
                        message: "You are not authorized to delete this image.",
                        errorID: "notAuthorized",
                    });
                }
                databaseOps.deleteImage(id, function(err, result) {
                    if (err) {
                        return sendError(err, next, {
                            errorID: "databaseError",
                        });
                    }
                    logger.info("Deleted image " + id + ".");
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
                            logger.error(err);
                        }
                    });
                    res.status(200);
                    sendSuccess(res, "Image of ID " + id + " deleted successfully.");
                });
            });
        });
    });

    app.use("/", router);
    app.use(errorHandler);
};
