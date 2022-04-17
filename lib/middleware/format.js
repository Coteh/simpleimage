module.exports = (format) => {
    return (req, res, next) => {
        req.format = format;
        next();
    };
};
