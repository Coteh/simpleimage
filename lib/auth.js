const bcrypt = require("bcrypt");
const crypto = require("crypto");

var preHashPassword = function(password) {
    let hash = crypto.createHash("sha512");
    hash.update(password, "utf8");
    return hash.digest("utf8");
}

/**
 * Hashes a password
 * @param {string} password
 * @returns {Promise} Promise object that will contain the hashed password if successful, otherwise error
 */
var hashPassword = function(password) {
    return new Promise(function(resolve, reject) {
        if (typeof password !== "string") {
            reject(new Error("Cannot hash non-string password"));
            return;
        }
        let hashedPassword = preHashPassword(password);
        bcrypt.hash(hashedPassword, 10, function (err, hash) {
            if (err) {
                reject(new Error("Error hashing password"));
                return;
            }
            resolve(hash);
        });
    });
};

/**
 * Authenticates an attempted password against a user's hashed password in database
 * @param {User} user
 * @param {string} passwordAttempt
 * @returns {Promise} Promise object indicating whether the user was successfully authenticated
 */
var authenticateUser = function(user, passwordAttempt) {
    return new Promise(function(resolve, reject) {
        if (typeof passwordAttempt !== "string") {
            reject(new Error("Could not login user. Invalid password value provided."));
            return;
        }
        if (!user || typeof user.password !== "string") {
            reject(new Error("Could not login user. Invalid user value provided."));
            return;
        }
        let hashedPasswordAttempt = preHashPassword(passwordAttempt);
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

module.exports.hashPassword = hashPassword;
module.exports.authenticateUser = authenticateUser;
