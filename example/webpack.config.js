const path = require('path');
const webpack = require('webpack');
const HtmlResourceWebpackPlugin = require('../index');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin-x');

module.exports = {
    //target: 'node',
    entry: {
        'js/index': './index.js',
        //inde: './index.js'
    },
    output: {
        path: path.resolve(__dirname, './dist'),
        filename: '[name].[chunkhash:6].js',
        publicPath: "//s.url.cn/near-index/i/"
    },
    module: {
        rules: [{
                test: /\.js$/,
                use: [{
                    loader: 'babel-loader'
                }],
                exclude: /node_modules/
            }
            // ,
            // {
            //     test: /\.scss$/,
            //     use: ExtractTextPlugin.extract({
            //         fallback: "style-loader",
            //         use: [{
            //             loader: "css-loader"
            //         }, {
            //             loader: "sass-loader",
            //             // options: {
            //             //     includePaths: [path.join(__dirname,)]
            //             // }
            //         }]
            //     })
            // },
            // ExtractTextPlugin.extract({
            //     fallback: 'style-loader',
            //     use: merge([], commonLoaders).concat([{
            //         loader: 'sass-loader'
            //     }])
            // })
            // {
            //     test: /\.html$/,
            //     use: [{
            //             loader: 'html-res-loader'
            //         }]
            //         // use: [{
            //         //     loader: 'html-loader',
            //         //     options: {
            //         //         minimize: true,
            //         //         root: path.resolve(__dirname, './')
            //         //     }
            //         // }]
            // },
            , {
                test: /\.(jpe?g|png|gif|svg)$/i,
                use: [
                    'url-loader?limit=10000',
                    'img-loader'
                ]
            },

        ]
    },
    plugins: [
        // new ExtractTextPlugin({
        //     filename: (getPath) => {
        //         return getPath('css/[name].css').replace('css/js', 'css');
        //     },
        //     allChunks: true
        // }),
        new webpack.optimize.ModuleConcatenationPlugin(),
        // new CopyWebpackPlugin([{
        //     from: 'libs/',
        //     to: 'libs/[name].[hash:6].[ext]'
        // }]),
        new HtmlResourceWebpackPlugin({
            filename: 'index.html',
            script: path.resolve(__dirname, './index.js'),
            template: path.resolve(__dirname, './index.html'),
            getPath(chunkId, res) {
                return res + '?_offline=1'
            },
            beforeHtmlEmit(chunkId, res) {
                return res;
            }
        })
    ]
}