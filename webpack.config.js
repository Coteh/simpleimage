var path = require("path");
var CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    mode: "production",
    entry: {
        'assets/js/home.bundle': ['./assets/js/main.js', './assets/js/file-upload.js', './assets/js/util-frontend.js', './assets/js/image-util-frontend.js'],
        'assets/js/image.bundle': ['./assets/js/main.js', './assets/js/image.js', './assets/js/util-frontend.js'],
        'assets/js/user.bundle': ['./assets/js/main.js', './assets/js/user.js', './assets/js/util-frontend.js']
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'public')
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'assets/css',
                    to: 'assets/css'
                },
                {
                    from: 'assets/font',
                    to: 'assets/font'
                },
                {
                    from: 'assets/images',
                    to: 'assets/images'
                },
                {
                    from: 'favicon.ico',
                    to: 'favicon.ico'
                },
            ],
        }),
    ],
};