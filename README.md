<h1 align="center">html-webpack-plugin-x</h1>

<h2 align="center">Install</h2>

```bash
npm install --save-dev html-webpack-plugin-x
```

<h2 align="center">Usage</h2>

The plugin will generate an HTML5 file for you that includes all your `webpack`
bundles in the body using `script` tags. Just add the plugin to your `webpack`
config as follows:

**webpack.config.js**
```js
const HtmlWebpackPlugin = require('html-webpack-plugin-x')

module.exports = {
  entry: 'index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'index_bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin()
  ]
}
```

This will generate a file `dist/index.html` containing the following

```html
<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="name" itemprop="name" content="feflow" />
    <title>html resource webpack plugin template</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>

<body>
    <div id="container"></div>
</body>

</html>
```


<h2 align="center">Options</h2>

You can pass a hash of configuration options to `html-webpack-plugin`.
Allowed values are as follows

|Name|Type|Default|Description|
|:--:|:--:|:-----:|:----------|
|**[`filename`](#)**|`{String}`|`'index.html'`|The file to write the HTML to. Defaults to `index.html`. You can specify a subdirectory here too (eg: `webserver/index.html`)|
|**[`template`](#)**|`{String}`|``|`webpack` require path to the template. generate the html|
|**[`getPath`](#)**|`{Function}`||change the html refer js or css href|
|**[`beforeHtmlEmit`](#)**|`{Function}`||last change the output html, you can inject resource etc|

Here's an example webpack config illustrating how to use these options

**webpack.config.js**
```js
{
  entry: 'index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'index_bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve(__dirname, './index.html'),
      getPath(chunkId, res) {
          return res + '?_offline=1'
      },
      beforeHtmlEmit(chunkId, res) {
          console.log(chunkId);
          return res;
      }
    })
  ]
}
```

### `Generating Multiple HTML Files`

To generate more than one HTML file, declare the plugin more than
once in your plugins array

**webpack.config.js**
```js
{
  entry: 'index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'index_bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin(), // Generates default index.html
    new HtmlWebpackPlugin({  // Also generate a test.html
      filename: 'index.html',
      template: path.resolve(__dirname, './index.html'),
      getPath(chunkId, res) {
          return res + '?_offline=1'
      },
      beforeHtmlEmit(chunkId, res) {
          console.log(chunkId);
          return res;
      }
    })
  ]
}
```
