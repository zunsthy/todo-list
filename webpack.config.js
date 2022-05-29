const path = require("path");
const os = require("os");
const HtmlWebpackPlugin = require("html-webpack-plugin");
// const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const env =
  process.env.NODE_ENV === "production" ? "production" : "development";
const devMode = env !== "production";
const port = +(process.env.PORT || "8080");
const wsl = os.platform() === "linux" && os.release().includes("microsoft");

const config = {
  entry: {
    "todo-list": "./src/todo-list.js",
  },
  mode: env,
  watchOptions: {
    ignored: /node_modules/,
  },
  devtool: devMode ? "cheap-module-source-map" : "source-map",
  // stats: 'errors-warnings',
  bail: !devMode,
  cache: {
    type: "filesystem",
    buildDependencies: {
      config: [__filename],
    },
  },
  output: {
    clean: true,
    filename: "[name].[contenthash:8].js",
    chunkFilename: "[name].[contenthash:8].js",
    path: path.resolve(__dirname, "dist"),
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "./todo-list.html",
      template: "./src/index.html",
      inject: "body",
    }),
    // new WebpackManifestPlugin(),
    devMode
      ? null
      : new MiniCssExtractPlugin({
          filename: "[name].[contenthash:8].css",
        }),
  ].filter(Boolean),
  module: {
    rules: [
      {
        enforce: "pre",
        test: /\.(js|mjs|jsx|ts|tsx|css)$/,
        loader: "source-map-loader",
      },
      {
        test: /\.(jsx|js)$/,
        include: path.resolve(__dirname, "./src"),
        use: [
          {
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
              cacheCompression: false,
              // compact: !devMode,
            },
          },
        ],
      },
      {
        test: /\.css$/i,
        use: [
          devMode ? "style-loader" : MiniCssExtractPlugin.loader,
          "css-loader",
        ],
      },
    ],
  },
  optimization: {
    // minimize: !devMode,
  },
};

if (devMode) {
  config.devServer = {
    static: "./dist",
    port,
  };
}

if (wsl) {
  config.watchOptions.poll = true;
}

module.exports = config;
