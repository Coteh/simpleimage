module.exports.sendError = (err, next, options) => {
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

    var additionalInfo = Object.keys(options)
        .filter(function (key) {
            return !filteredProps.includes(key);
        })
        .reduce(function (obj, key) {
            obj[key] = options[key];
            return obj;
        }, {});

    // Only make the additionalInfo object visible in error JSON
    // if there's actually stuff in it.
    if (Object.keys(additionalInfo).length > 0) {
        errObj.additionalInfo = additionalInfo;
    }

    next(errObj);
};

module.exports.sendSuccess = (res, message, data) => {
    res.send({
        status: "success",
        message,
        ...data,
    });
};
