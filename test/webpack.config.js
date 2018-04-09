const path = require('path');
const HtmlResourceWebpackPlugin = require('../index');


module.exports = {
    //target: 'node',
    entry: {
        index: './index.js',
        //inde: './index.js'
    },
    output: {
        path: path.resolve(__dirname, './dist'),
        filename: '[name].js',
        publicPath: "./dist/"
    },
    module: {
        rules: [{
                test: /\.js$/,
                use: [{
                    loader: 'babel-loader'
                }],
                exclude: /node_modules/
            },
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
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                use: [
                    'url-loader?limit=10000',
                    'img-loader'
                ]
            }
        ]
    },
    plugins: [
        new HtmlResourceWebpackPlugin({

        })
    ]
}