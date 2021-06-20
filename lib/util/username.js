const UsernameError = Object.freeze({
    USERNAME_TOO_LONG: "USERNAME_TOO_LONG",
});

module.exports.UsernameError = UsernameError;
module.exports.verifyUsername = (username) => {
    const maxUsernameLength = process.env.MAX_USERNAME_LENGTH || 24;
    let error = null;

    if (username.length > maxUsernameLength) {
        error = UsernameError.USERNAME_TOO_LONG;
    }

    return {
        valid: error == null,
        error,
    };
};
