module.exports.getDBHostURI = function () {
    return process.env.MONGODB_URI || "mongodb://localhost:27017/simpleimage";
};
