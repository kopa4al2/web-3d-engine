const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require("html-webpack-plugin");


module.exports = {
    entry: './src/index.ts',
    output: {
        filename: 'bundle.js',
        // path: path.resolve(__dirname, 'src'),
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
        alias: {
            core: path.resolve(__dirname, './src/core'),
            webgl: path.resolve(__dirname, './src/webgl'),
            webgpu: path.resolve(__dirname, './src/webgpu'),
            util: path.resolve(__dirname, './src/util'),
            engine: path.resolve(__dirname, './src/engine'),
        },
        extensions: ['.ts', '.js'],
        preferRelative: true,
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(scss)$/, // Match .scss files
                use: [
                    'style-loader',   // Injects CSS into the DOM (use this for development)
                    'css-loader',     // Resolves @import and url() and converts it to JS
                    {
                        loader: 'sass-loader',
                        options: {
                            sassOptions: {
                                quietDeps: true,  // Suppresses warnings for deprecated functions
                            },
                        },
                    },
                ],
            },
            {
                test: /\.(vert|frag|wgsl)$/i,
                use: 'raw-loader',
                // exclude: /node_modules/,
            }
        ],
    },
    devServer: {
        static: './assets',
        hot: true,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',  // Your custom HTML template
            inject: 'body',                // Inject the scripts at the end of the body
        }),
        new CopyWebpackPlugin({
            patterns: [
                // { from: 'src/index.html', to: 'index.html' },
                { from: 'assets', to: 'assets', filter: (path) => !path.includes('-hdr') },
            ],
            options: {
                concurrency: 2
            }
        }),
    ]
};