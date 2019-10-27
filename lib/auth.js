const bcrypt = require("bcrypt");
const crypto = require("crypto");
const errMsgs = require("./error-msgs");

const ERRORS = {
    CANNOT_HASH_NONSTRING: "Cannot hash non-string password",
    ERROR_HASHING: "Error hashing password",
    INVALID_PASSWORD_ATTEMPT: "Invalid password value provided for user authentication.",
    INVALID_AUTH_USER: "Invalid user value provided for user authentication.",
    AUTH_ERROR: "There was an error verifying password attempt."
};

var preHashPassword = function(password) {
    let hash = crypto.createHash("sha512");
    hash.update(password, "utf8");
    return hash.digest("utf8");
};

/**
 * Hashes a password
 * @param {string} password
 * @returns {Promise} Promise object that will contain the hashed password if successful, otherwise error
 */
var hashPassword = function(password) {
    return new Promise(function(resolve, reject) {
        if (typeof password !== "string") {
            reject(new Error(ERRORS.CANNOT_HASH_NONSTRING));
            return;
        }
        let hashedPassword = preHashPassword(password);
        bcrypt.hash(hashedPassword, 10, function (err, hash) {
            if (err) {
                reject(new Error(ERRORS.ERROR_HASHING));
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
            reject(new Error(ERRORS.INVALID_PASSWORD_ATTEMPT));
            return;
        }
        if (!user || typeof user.password !== "string") {
            reject(new Error(ERRORS.INVALID_AUTH_USER));
            return;
        }
        let hashedPasswordAttempt = preHashPassword(passwordAttempt);
        bcrypt.compare(hashedPasswordAttempt, user.password, function (err, result) {
            if (err) {
                reject(new Error(ERRORS.AUTH_ERROR));
                return;
            }
            if (result) {
                resolve({
                    message: "Login successful.",
                    user
                });
            } else {
                reject(new Error(errMsgs.USERPASS_COMBO_NOT_FOUND));
            }
        });
    });
};

module.exports.hashPassword = hashPassword;
module.exports.authenticateUser = authenticateUser;

// Export error messages for tests
if (process.env.NODE_ENV === "test") {
    module.exports.ERRORS = ERRORS;
}
