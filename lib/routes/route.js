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
            routeError(next, options);
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
        var responseType = err.responseType || req.query.type;
        var statusCode = err.statusCode || 500;
        if (responseType === "json") {
            res.status(statusCode).send({
                status: "error",
                message: err.message || "failed",
                errorID: err.errorID,
                additionalInfo: err.additionalInfo
            });
        } else {
            renderError(res, statusCode, err.message, err.errorID, err.additionalInfo);
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
        errObj.errorID = options.errorID;

        // Additional properties added to options besides the ones below (in filteredProps)
        // will be filtered into an "additionalInfo" object to be sent with response.
        var filteredProps = ["message", "statusCode", "responseType", "errorID"];

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
            logger.info("Served 'removed' placeholder image by direct link");
            return;
        }
        databaseOps.findImage(id, function(err, imageEntry) {
            if (err) {
                logger.error("Error finding image from database", err);
                routeError(err, next, {
                    message: "Error finding image. Please try again later.",
                    statusCode: 500
                });
                return;
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
                        user: sessionObj.user
                    });
                    logger.info("Served image " + imageEntry[0].id + " via image page");
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
                // TODO:#127 Make decision to provide html or json response using Accept header from request
                if (req.query.type === "json") {
                    res.send(util.createJSONResponseObject("success", user.username));
                } else { //html
                    res.type("html");
                    res.append("Cache-Control", "private, max-age=0, must-revalidate");
                    res.render("user-view", {
                        user,
                        sessionUser: sessionObj.user
                    });
                }
                logger.info("Served user page of user " + user.username + ".");
            });
        });
    });

    router.get("/settings", function(req, res, next) {
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

            res.render("settings-view", {
                sessionUser: sessionObj.user,
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
                // TODO:#127 Make decision to provide html or json response using Accept header from request
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
            // TODO:#127 Make decision to provide html or json response using Accept header from request
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
            if (req.query.type === "html") {
                res.set("Content-Type", "text/html; charset=utf-8");
            } else {
                res.set("Content-Type", "application/json; charset=utf-8");
            }

            if (result.length === 0) {
                // TODO:#127 Make decision to provide html or json response using Accept header from request
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
            // TODO:#127 Make decision to provide html or json response using Accept header from request
            if (req.query.type === "html") {
                const promises = comments.map(comment => new Promise((resolve, reject) => {
                    databaseOps.findImageAttributes(comment.imageID, (err, results) => {
                        if (err) {
                            logger.error(`Could not find attributes for image of ID ${comment.imageID} for user comments page, err: `, err);
                            reject(err);
                            return;
                        }
                        resolve(results);
                    });
                }));
                Promise.allSettled(promises)
                    .then(results => {
                        if (results.some(result => result.status === "rejected")) {
                            routeError(err, next, {
                                message: "Could not load comments for user " + username + ".",
                                errorID: "imageAttribsError",
                                statusCode: 500
                            });
                            return;
                        }
                        const images = results.reduce((dict, result) => {
                            if (result.status === "fulfilled" && result.value.length > 0) {
                                dict[result.value[0].id] = result.value[0];
                            }
                            return dict;
                        }, {});
                        message = commentUtil.prepareCommentsHTML(comments, "user", {
                            images,
                        });
                        res.send(message);
                    });
            } else { //json
                message = {
                    status: "success",
                    result_count: result.length,
                    results: commentUtil.prepareComments(comments, req.query.responseType || req.query.type, "user")
                };
                res.send(message);
            }
        });
    });

    router.get("/users/:username/images", function(req, res, next) {
        var username = req.params.username;
        if (username === undefined) {
            routeError(next, {
                message: "Username entered is incorrect or malformed."
            });
            return;
        }

        databaseOps.findImagesForUser(username, function(err, images) {
            if (err) {
                // TODO use error codes instead of messages to determine type of error and return appropriate status code
                routeError(next, {
                    message: "Images could not be found for user " + username + ".",
                    statusCode: 404,
                });
                return;
            }
            
            res.status(200);
            // TODO:#127 Make decision to provide html or json response using Accept header from request
            if (req.query.type === "html") {
                res.type("html");
                var finalHTML = "<div id='user-images'>";
                images.forEach(function(elem) {
                    finalHTML += userUtil.generateUserImageHTML(elem);
                });
                finalHTML += "</div>";
                res.send(finalHTML);
            } else {
                res.type("json");
                res.send({
                    status: "Success",
                    images: images.map((elem) => userUtil.generateUserImageJSON(elem))
                });
            }
        });
    });

    router.get("/register", function(req, res, next) {
        res.render("register-view", {
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

    router.get("/user", function (req, res, next) {
        handleSession(req.session, function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    var err = {
                        message: "Cannot retrieve status. User no longer exists."
                    };
                    return routeError(err, next, {
                        errorID: "sessionUserNotFound",
                        statusCode: 404,
                        responseType: "json"
                    });
                } else {
                    return routeError(err, next);
                }
            }
            if (sessionObj.guest) {
                var err = {
                    message: "Cannot retrieve status. Not signed in."
                };
                return routeError(err, next, {
                    errorID: "notSignedIn",
                    statusCode: 400,
                    responseType: "json"
                });
            }
            else {
                res.status(200);
                return res.send({
                    status: "success",
                    message: "User logged in"
                });
            }
        })
    })

    router.get("/check_username", limiter, function(req, res, next) {
        let username = req.query.username;
        if (!username) {
            routeError(next, {
                message: "No username to check.",
                errorID: "noUsernameToCheck",
                statusCode: 400,
                // TODO:#127 This route should always provide JSON response, but in general allow response type to be configured using "Accept" HTTP header instead of query parameter
                responseType: "json",
            });
            return;
        }
        if (typeof username !== "string") {
            if (Array.isArray(username)) {
                username = username[0];
            } else {
                routeError(next, {
                    message: "Invalid username specified.",
                    errorID: "invalidUsernameToCheck",
                    statusCode: 400,
                    // TODO:#127 This route should always provide JSON response, but in general allow response type to be configured using "Accept" HTTP header instead of query parameter
                    responseType: "json",
                });
                return;
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
            routeError(next, {
                message,
                errorID,
                statusCode: 400,
                // TODO:#127 This route should always provide JSON response, but in general allow response type to be configured using "Accept" HTTP header instead of query parameter
                responseType: "json",
            });
            return;
        }
        logger.info("Checking for existence of user " + username + ".");
        databaseOps.findUser(username, function (err, result) {
            if (err) {
                if (err.message === "Invalid username") {
                    routeError(err, next, {
                        message: "Error checking user",
                        errorID: "errorCheckingUser",
                        statusCode: 400,
                        // TODO:#127 This route should always provide JSON response, but in general allow response type to be configured using "Accept" HTTP header instead of query parameter
                        responseType: "json",
                    });    
                    return;
                }
                routeError(err, next, {
                    message: "Error checking user",
                    errorID: "errorCheckingUser",
                    statusCode: 500,
                    // TODO:#127 This route should always provide JSON response, but in general allow response type to be configured using "Accept" HTTP header instead of query parameter
                    responseType: "json",
                });
                return;
            }

            const exists = result.length > 0;
            logger.info("User " + username + (exists ? " exists." : " does not exist."));
            res.status(200);
            res.send(util.createJSONResponseObject("success", {
                exists,
            }));
        });
    });

    router.get("/login", function (req, res, next) {
        res.render("login-view", {
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

    router.post("/upload", uploadLimiter, function(req, res, next) {
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

    router.post("/comment", commentsLimiter, function(req, res, next) {
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

    router.post("/register", limiter, function(req, res, next) {
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

        const usernameCheckResult = usernameUtil.isValidUsername(req.body.username);
        if (!usernameCheckResult.valid) {
            switch (usernameCheckResult.error) {
                case usernameUtil.UsernameError.USERNAME_TOO_LONG:
                    logger.error(`Could not register user ${req.body.username}. Username contains too many characters.`);
                    routeError(next, {
                        message: "Could not register user. Username contains too many characters.",
                        field: "username",
                    });
                    break;
                default:
                    logger.error(`Could not register user ${req.body.username}. Unknown error with username check.`);
                    routeError(next, {
                        message: "Could not register user. Unknown error.",
                    });
            }
            return;
        }

        const passwordStrengthResult = passwordUtil.verifyPasswordStrength(req.body.password);
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

            // TODO:#127 Make decision to provide html or json response using Accept header from request
            if (req.query.type === "json") {
                res.status(200).send({
                    status: "success",
                    message: "User registered."
                });
            } else {
                res.redirect(util.getRedirectPath(req.header("Referrer")));
            }
        });
    });

    router.post("/login", authLimiter, function(req, res, next) {
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
            // TODO:#127 Make decision to provide html or json response using Accept header from request
            if (req.query.type === "json") {
                res.status(200);
                res.send({
                    status: "success",
                    message: result.message
                });
            } else {
                res.redirect(util.getRedirectPath(req.header("Referrer")));
            }
        });
    });

    router.post("/change_password", limiter, function (req, res, next) {
        handleSession(req.session, async function (err, sessionObj) {
            if (err) {
                if (err.type === "userID") {
                    req.session.userID = undefined;
                    err.message = "There was an error changing password for this user. "
                        + "User could not be found. Ensure that user hasn't been deleted and try again.";
                }
                routeError(err, next, {
                    errorID: "sessionUserNotFound",
                    statusCode: 404
                });
                return;
            }

            if (sessionObj.guest) {
                var err = {
                    message: "Cannot perform action. Not signed in."
                };
                routeError(err, next, {
                    errorID: "notSignedIn",
                    statusCode: 400
                });
                return;
            }

            var userData = sessionObj.user;

            if (req.body.oldPassword === undefined
                || req.body.oldPassword === "") {
                routeError(next, {
                    errorID: "missingOldPassword",
                    message: "Could not change password. Missing old password.",
                    field: "oldPassword",
                    statusCode: 400
                });
                return;
            }
            if (req.body.newPassword === undefined
                || req.body.newPassword === "") {
                routeError(next, {
                    errorID: "missingNewPassword",
                    message: "Could not change password. Missing new password.",
                    field: "newPassword",
                    statusCode: 400
                });
                return;
            }
            if (req.body.newPasswordConfirm === undefined
                || req.body.newPasswordConfirm === "") {
                routeError(next, {
                    errorID: "missingNewPasswordConfirm",
                    message: "Could not change password. Missing new password confirmation.",
                    field: "newPasswordConfirm",
                    statusCode: 400
                });
                return;
            }

            databaseOps.findUser(userData.username, async function (err, results) {
                if (err || results.length === 0) {
                    if (err) {
                        logger.error(err.stack);
                    } else {
                        logger.error("Could not find user '" + userData.username + "' in database");
                    }
                    routeError(next, {
                        errorID: "userNotFound",
                        message: "Could not change password. Could not find user in database."
                    });
                    return;
                }

                var user = results[0];

                var result = false;
                try {
                    result = await auth.authenticateUser(user, req.body.oldPassword);
                } catch (e) {
                    logger.error("Error authenticating old password of user", e);
                }

                if (!result) {
                    routeError(next, {
                        errorID: "oldPasswordIncorrect",
                        message: "Could not change password. Old password is not correct.",
                        field: "oldPassword",
                        statusCode: 400
                    });
                    return;
                }

                if (req.body.newPassword !== req.body.newPasswordConfirm) {
                    routeError(next, {
                        errorID: "passwordsDoNotMatch",
                        message: "Could not change password. Passwords don't match.",
                        fields: ["newPassword", "newPasswordConfirm"],
                        statusCode: 400
                    });
                    return;
                }

                if (req.body.newPassword === req.body.oldPassword) {
                    routeError(next, {
                        errorID: "passwordSame",
                        message: "Could not change password. New password is the same as the old password.",
                        fields: ["oldPassword", "newPassword", "newPasswordConfirm"],
                        statusCode: 400
                    });
                    return;
                }

                let passwordStrengthResult = passwordUtil.verifyPasswordStrength(req.body.newPassword);

                if (!passwordStrengthResult.strong) {
                    routeError(next, {
                        errorID: "passwordNotStrong",
                        message: passwordStrengthResult.errors.join("\n"),
                        field: "newPassword",
                        statusCode: 400
                    });
                    return;
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

                        // TODO:#127 Make decision to provide html or json response using Accept header from request
                        if (req.query.type === "json") {
                            res.status(200);
                            res.send({
                                status: "success",
                                message: "Password changed"
                            });
                        } else {
                            res.redirect(util.getRedirectPath("/settings"));
                        }
                    })
                    .catch((err) => {
                        routeError(next, {
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
        var referrer = req.header("Referrer");
        if (referrer.indexOf("/settings") >= 0) {
            res.redirect(util.getRedirectPath("/"));
        } else {
            res.redirect(util.getRedirectPath(req.header("Referrer")));
        }
    });

    router.delete("/images/:id", limiter, function (req, res, next) {
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
