const rateLimit = require("express-rate-limit");
const { sendError } = require("../util/response");
let RateLimitRedisStore;
if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development") {
    RateLimitRedisStore = require("rate-limit-redis");
}

let uploadLimiter, commentsLimiter, authLimiter, limiter;
const uploadLimitSeconds = 60 * 60; // 1 hour window
const commentsLimitSeconds = 60 * 60; // 1 hour window
const authLimitSeconds = 60 * 60; // 1 hour window
const requestLimitSeconds = 60 * 60; // 1 hour window

const createLimitKeyFunc = (id) => {
    return (req) => {
        return req.ip + ":" + id;
    };
};

const createLimitHandler = (options) => {
    return (req, res, next) => {
        sendError(next, options);
    };
};

const createRateLimitStore = (options) => {
    if (!(process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development")) {
        // use express-rate-limit's memory store by giving it undefined
        return undefined;
    }
    return new RateLimitRedisStore(
        Object.assign(
            {
                redisURL: process.env.REDIS_URL,
            },
            options
        )
    );
};

// TODO add dedicated config object so that the e2e environment variable can be mapped nicely to a boolean
if (process.env.NODE_ENV !== "test" && process.env.IS_E2E !== "true") {
    uploadLimiter = rateLimit({
        store: createRateLimitStore({
            expiry: uploadLimitSeconds,
        }),
        windowMs: uploadLimitSeconds * 1000,
        max: 10,
        keyGenerator: createLimitKeyFunc("uploads"),
        handler: createLimitHandler({
            statusCode: 429,
            message: "Upload rate limit has been reached. Try again later.",
        }),
    });

    commentsLimiter = rateLimit({
        store: createRateLimitStore({
            expiry: commentsLimitSeconds,
        }),
        windowMs: commentsLimitSeconds * 1000,
        max: 25,
        keyGenerator: createLimitKeyFunc("comments"),
        handler: createLimitHandler({
            statusCode: 429,
            message: "Comment rate limit has been reached. Try again later.",
        }),
    });

    authLimiter = rateLimit({
        store: createRateLimitStore({
            expiry: authLimitSeconds,
        }),
        windowMs: authLimitSeconds * 1000,
        max: 10,
        keyGenerator: createLimitKeyFunc("auth"),
        handler: createLimitHandler({
            statusCode: 429,
            message: "Too many login attempts. Try again later.",
        }),
    });

    limiter = rateLimit({
        store: createRateLimitStore({
            expiry: requestLimitSeconds,
        }),
        windowMs: requestLimitSeconds * 1000,
        max: 100,
        keyGenerator: createLimitKeyFunc("requests"),
        handler: createLimitHandler({
            statusCode: 429,
            message: "Request rate limit has been reached. Try again later.",
        }),
    });
} else {
    const dummyRateLimiter = (req, res, next) => {
        next();
    };

    uploadLimiter = dummyRateLimiter;
    commentsLimiter = dummyRateLimiter;
    authLimiter = dummyRateLimiter;
    limiter = dummyRateLimiter;
}

module.exports.uploadLimiter = uploadLimiter;
module.exports.commentsLimiter = commentsLimiter;
module.exports.authLimiter = authLimiter;
module.exports.limiter = limiter;
