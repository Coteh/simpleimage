const UsernameError = Object.freeze({
    USERNAME_TOO_LONG: "USERNAME_TOO_LONG",
    USERNAME_NOT_STRING: "USERNAME_NOT_STRING",
});

module.exports.UsernameError = UsernameError;
module.exports.isValidUsername = (username) => {
    const maxUsernameLength = process.env.MAX_USERNAME_LENGTH || 24;
    let error = null;

    if (typeof username !== "string") {
        error = UsernameError.USERNAME_NOT_STRING;
    } else if (username.length > maxUsernameLength) {
        error = UsernameError.USERNAME_TOO_LONG;
    }

    return {
        valid: error == null,
        error,
    };
};
