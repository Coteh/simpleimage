const bcrypt = require("bcrypt");
const crypto = require("crypto");

var authenticateUser = function(user, passwordAttempt) {
    return new Promise(function(resolve, reject) {
        let hash = crypto.createHash("sha512");
        hash.update(passwordAttempt, "utf8");
        let hashedPasswordAttempt = hash.digest("utf8");
        bcrypt.compare(hashedPasswordAttempt, user.password, function (err, result) {
            if (err) {
                reject(new Error("Could not login user. There was an error verifying user."));
                return;
            }
            if (result) {
                resolve({
                    message: "Login successful.",
                    user
                });
            } else {
                reject(new Error("Could not login user. Username and password combination not found."));
            }
        });
    });
};

module.exports.authenticateUser = authenticateUser;
