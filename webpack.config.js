const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
    // mode: "production",
    entry: './src/index.ts',
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
        alias: {
            core: path.resolve(__dirname, './src/core'),
            webgl: path.resolve(__dirname, './src/webgl'),
            webgpu: path.resolve(__dirname, './src/webgpu'),
            utils: path.resolve(__dirname, './src/utils'),
            engine: path.resolve(__dirname, './src/engine'),
        },
        extensions: ['.ts', '.js'],
        preferRelative: true,
    },
    optimization: {
        usedExports: true,
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                // sharedWorkers: {
                //     test: /[\\/]workers[\\/]/, // Match worker files
                //     name: 'shared-workers',
                //     chunks: 'all',
                // },
                core: {
                    test: /[\\/]src[\\/]core[\\/]/,
                    name: 'core',
                    chunks: 'all',
                },
                webgl: {
                    test: /[\\/]src[\\/]webgl[\\/]/,
                    name: 'webgl',
                    chunks: 'all',
                },
                webgpu: {
                    test: /[\\/]src[\\/]webgpu[\\/]/,
                    name: 'webgpu',
                    chunks: 'all',
                },
                utils: {
                    test: /[\\/]src[\\/]utils[\\/]/,
                    name: 'utils',
                    chunks: 'all',
                },
                engine: {
                    test: /[\\/]src[\\/]engine[\\/]/,
                    name: 'engine',
                    chunks: 'all',
                },
                // glMatrix: {
                //     test: /[\\/]node_modules[\\/]gl-matrix[\\/]/,
                //     name: 'gl-matrix',
                //     chunks: 'all',
                // },
                // vendors: {
                //     test: /[\\/]node_modules[\\/]/,
                //     name: 'vendors',
                //     chunks: 'all',
                // },
            }
        },
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
            },
            // {
            //     test: /\.worker\.(js|ts)$/,
            //     use: { loader: 'worker-loader', options: { inline: 'no-fallback' } },
            // },
        ],
    },
    devServer: {
        // devMiddleware: {
        //     writeToDisk: true,
        // },
        // static: './dist',
        hot: true,
        headers: {
            // 'Cache-Control': 'public, max-age=3600',
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    plugins: [
        new CircularDependencyPlugin({
            exclude: /node_modules/,
            failOnError: true,
        }),
        new HtmlWebpackPlugin({
            template: './src/index.html',  // Your custom HTML template
            inject: 'body',                // Inject the scripts at the end of the body
        }),
        new CopyWebpackPlugin({
            patterns: [
                // { from: 'src/index.html', to: 'index.html' },
                { from: 'assets', to: 'assets' },
                // { from: 'assets', to: 'assets', filter: (path) => !path.includes('-hdr') },
            ],
            options: {
                concurrency: 2
            }
        }),
        // new BundleAnalyzerPlugin(),
    ]
};