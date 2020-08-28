const owasp = require("owasp-password-strength-test");

module.exports.verifyPasswordStrength = function(password) {
    if (process.env.NODE_ENV === "development") {
        return {
            strong: true,
            errors: [],
        };
    }
    const owaspResult = owasp.test(password);
    return {
        strong: owaspResult.strong,
        errors: owaspResult.errors,
    };
}
