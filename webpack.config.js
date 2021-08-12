require("dotenv").config();
var path = require("path");
var CopyWebpackPlugin = require("copy-webpack-plugin");
const SentryWebpackPlugin = require("@sentry/webpack-plugin");
const { DefinePlugin } = require("webpack");

module.exports = {
    mode: "production",
    devtool: "source-map",
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
        new SentryWebpackPlugin({
            // sentry-cli configuration
            authToken: process.env.SENTRY_AUTH_TOKEN,
            org: process.env.SENTRY_ORG,
            project: "simpleimage",
            release: "simpleimage@" + process.env.npm_package_version,
            // rewrites "~/public/assets/js" prefix into "~/assets/js" so Sentry can detect the source maps
            urlPrefix: "~/assets/js",

            // webpack-specific configuration
            include: ["./public/assets/js"],
            ignore: ["node_modules", "webpack.config.js"],
        }),
        new DefinePlugin({
            "SI_VERSION": JSON.stringify(process.env.npm_package_version),
            "NODE_ENV": JSON.stringify(process.env.NODE_ENV) || "development",
            "SENTRY_DSN": JSON.stringify(process.env.SENTRY_DSN),
        }),
    ],
};
