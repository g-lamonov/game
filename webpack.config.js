const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: `./lib/game.js`,
    output: {
        path: path.join(__dirname, "dist"),
        filename: "game.js",
        chunkFilename: "[name].js?m=[chunkhash]"
    },
    mode: "development",
    resolve: {
        symlinks: false,
        mainFields: ["browser", "main", "module"]
    },
    node: {
        fs: "empty"
    },
    devServer: {
        host: "0.0.0.0",
        port: 8000,
        disableHostCheck: true,
        watchOptions: {
            ignored: [
                path.resolve(__dirname, "src/**/*.ts")
            ]
        },
    },
    devtool: "source-map",
    stats: {
        warningsFilter: /System.import/
    },
    performance: {
        maxAssetSize: 16777216,
        maxEntrypointSize: 16777216
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                include: [
                    path.resolve(__dirname, "lib")
                ],
                use: ["source-map-loader"],
                enforce: "pre"
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin([
            { from: "src/demo/**/*.{html,css}" },
            { from: "assets/", to: "assets/" },
            { from: "index.html", transform(content) {
                return content.toString().replace("src=\"node_modules/steal/steal.js\" main=\"lib/game\"",
                    "src=\"game.js\"");
            }},
            { from: "style.css" }
        ])
    ]
}
