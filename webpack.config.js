const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');


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
                test: /\.(vert|frag|wgsl)$/i,
                use: 'raw-loader',
                // exclude: /node_modules/,
            }
        ],
    },
    devServer: {
        // static: './dist', // Replace contentBase with static
        static: './assets', // Replace contentBase with static
        hot: true,
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: 'src/index.html', to: 'index.html' },
                { from: 'assets', to: 'assets' },
                // { from: 'src', to: 'src' },
                // { from: 'html-resources', to: 'html-resources' },
            ],
        }),
    ]
};