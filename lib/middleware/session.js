const session = require("express-session");
const databaseOps = require("../database-ops");
const { logger } = require("../logger");
const { sendError } = require("../util/response");
var RedisStore, FileStore;
if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development") {
    RedisStore = require("connect-redis")(session);
} else {
    FileStore = require("session-file-store")(session);
}

const USER_NOT_FOUND = "UserNotFound";

class SessionError extends Error {
    constructor(type) {
        super(`Session error occurred: ${type}`);
        this.type = type;
    }
}

const getStore = () => {
    if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development") {
        return new RedisStore({
            url: process.env.REDIS_URL,
        });
    }
    if (process.env.NODE_ENV !== "test") {
        // If running on local machine, use file store sessions instead
        return new FileStore({
            path: "./sessions",
            ttl: 21600,
        });
    }
    return undefined;
};

module.exports.sessionsMiddleware = () => {
    if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
        throw new Error("Must provide a secret for sessions");
    }
    const sessionSecret = process.env.SESSION_SECRET;

    return session({
        store: getStore(),
        name: "si-session",
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure:
                // TODO add dedicated config object so that the e2e environment variable can be mapped nicely to a boolean
                (process.env.NODE_ENV === "production" && process.env.IS_E2E !== "true") ||
                (process.env.NODE_ENV === "development" && process.env.USE_DEV_HTTPS === "true"),
        },
    });
};

function handleSession(req) {
    const session = req.session;
    return new Promise((resolve, reject) => {
        var sessionObj = {};

        if (!session) {
            return reject(new Error("Sessions not setup properly"));
        }

        if (session.userID !== undefined) {
            databaseOps.findUserByHiddenID(session.userID, function (err, result) {
                if (err) {
                    let type;
                    switch (err.name) {
                        case "UserNotFound":
                            req.session.userID = undefined;
                            type = USER_NOT_FOUND;
                            break;
                    }
                    return reject(new SessionError(type));
                }

                var user = result[0];

                user = {
                    id: user._id.toString(),
                    username: user.username,
                    email: user.email,
                };

                sessionObj.user = user;

                resolve(sessionObj);
            });
        } else {
            sessionObj.guest = true;
            resolve(sessionObj);
        }
    });
}

module.exports.injectUser = async (req, res, next) => {
    try {
        const session = await handleSession(req);
        req.user = session.user;
        req.guest = session.guest;
        next();
    } catch (err) {
        logger.error(`middleware.session.injectUser: ${err}`);
        if (err.type === USER_NOT_FOUND) {
            return next();
        }
        sendError(err, next, {
            message: `Unknown error occurred when getting session. Please try again later.`,
            errorID: "unknownSessionUserError",
            statusCode: 500,
        });
    }
};

const requireUserWithMessage = (message) => async (req, res, next) => {
    try {
        const session = await handleSession(req);
        if (session.guest) {
            return sendError(next, {
                message: message || "Not logged in.",
                errorID: "notLoggedIn",
                statusCode: 401,
            });
        }
        req.user = session.user;
        req.guest = session.guest;
        next();
    } catch (err) {
        logger.error(`middleware.session.requireUser: ${err}`);
        if (err.type === USER_NOT_FOUND) {
            return sendError(err, next, {
                message: "User cannot be found or has been deleted.",
                errorID: "sessionUserNotFound",
                statusCode: 404,
            });
        }
        sendError(err, next, {
            message: `Unknown error occurred when getting session. Please try again later.`,
            errorID: "unknownSessionUserError",
            statusCode: 500,
        });
    }
};

module.exports.requireUser = requireUserWithMessage();
module.exports.requireUserWithMessage = requireUserWithMessage;
