module.exports.getDBHostURI = function () {
    switch (process.env.NODE_ENV) {
        case "production":
        case "development":
        case "test":
            return process.env.MONGODB_URI;
        default:
            return "mongodb://localhost:27017/simpleimage";
    }
};
