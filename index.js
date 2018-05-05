'use strict';

const vm = require('vm');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const loaderUtils = require('loader-utils');
const objectAssign = require('object-assign');
const prettyError = require('./lib/error.js');
const childCompiler = require('./lib/compiler');
const makeHelper = require('./lib/makeHelper');

let constants = {};

function loop() {}
let parseQuery = loop;

class HtmlResourceWebpackPlugin {
    constructor(options = {}) {
        this.options = objectAssign({}, {
            template: path.resolve(__dirname, 'default-index.html'),
            filename: 'index.html',
        }, options);
        this.webpackOptions = {};
    }

    apply(compiler) {
        const self = this;
        const context = compiler.context;
        const template = this.options.template;
        const filename = this.options.filename;
        let childCompilation = null;
        let isCompilationCached = false;

        const helper = makeHelper(context);
        const getRequestPath = helper.getRequestPath;
        constants = helper.constants;
        parseQuery = helper.parseQuery;

        this.webpackOptions = compiler.options;

        let makeHookCallback = (compilation, callback) => {
            childCompilation = childCompiler(getRequestPath(this, template), context, filename, compilation).catch((err) => {
                console.log(err)
                compilation.errors.push(prettyError(err, compiler.context).toString());
                return {
                    content: this.options.showErrors ? prettyError(err, compiler.context).toJsonHtml() : 'ERROR',
                    outputName: this.options.filename
                };
            }).then((compilationResult) => {
                isCompilationCached = compilationResult.hash && self.childCompilerHash === compilationResult.hash;
                self.childCompilerHash = compilationResult.hash;
                self.childCompilationOutputName = compilationResult.outputName;
                callback();
                return compilationResult.content;
            })
        }

        let makeEmitHookCallback = (compilation, callback) => {
            const chunkOnlyFilterConfig = {
                assets: false,
                cached: false,
                children: false,
                chunks: true,
                chunkModules: false,
                chunkOrigins: false,
                errorDetails: false,
                hash: false,
                modules: false,
                reasons: false,
                source: false,
                timings: false,
                version: false
            };
            const allChunks = compilation.getStats().toJson(chunkOnlyFilterConfig).chunks;
            const assets = this.getAssets(compilation, allChunks);
            // If the template and the assets did not change we don't have to emit the html
            const assetJson = JSON.stringify(this.getAssetFiles(assets));
            if (isCompilationCached && self.options.cache && assetJson === self.assetJson) {
                return callback();
            } else {
                self.assetJson = assetJson;
            }

            Promise.resolve()
                .then(() => childCompilation)
                .then((childCompilationTemplate) => {
                    return this.evaluateCompilationResult(compilation, childCompilationTemplate)
                })
                .then((html) => {
                    return html;
                })
                .then((html) => {
                    let _html = this.matchRes(
                        html,
                        assets.chunks,
                        assets.publicPath,
                        compilation.assets);

                    compilation.assets[self.childCompilationOutputName] = {
                        source: () => _html,
                        size: () => _html.length
                    };
                    callback();
                })
                .catch((err) => {
                    compilation.errors.push(prettyError(err, compiler.context).toString());
                    // Prevent caching
                    this.hash = null;
                    return this.options.showErrors ? prettyError(err, compiler.context).toHtml() : 'ERROR';
                })

        }

        if (compiler.hooks) {
            compiler.hooks.make.tapAsync('htmlResourcePlugin', makeHookCallback);
            compiler.hooks.emit.tapAsync('htmlResourcePlugin', makeEmitHookCallback);
        } else {
            compiler.plugin('make', makeHookCallback);
            compiler.plugin('emit', makeEmitHookCallback);
        }
    }

    /**
     * Evaluates the child compilation result
     * Returns a promise
     */
    evaluateCompilationResult(compilation, source) {
        if (!source) {
            return Promise.reject('The child compilation didn\'t provide a result');
        }
        console.log(source)
            // The LibraryTemplatePlugin stores the template result in a local variable.
            // To extract the result during the evaluation this part has to be removed.
        source = source.replace('var HTML_RESOURCE_WEBPACK_PLUGIN_RESULT =', '');
        const template = this.options.template.replace(/^.+!/, '').replace(/\?.+$/, '');
        const vmContext = vm.createContext(_.extend({ HTML_WEBPACK_PLUGIN: true, require: require }, global));
        const vmScript = new vm.Script(source, { filename: template });
        // Evaluate code and cast to string
        let newSource;
        try {
            newSource = vmScript.runInContext(vmContext);
        } catch (e) {
            return Promise.reject(e);
        }
        if (typeof newSource === 'object' && newSource.__esModule && newSource.default) {
            newSource = newSource.default;
        }
        return typeof newSource === 'string' || typeof newSource === 'function' ?
            Promise.resolve(newSource) :
            Promise.reject('The loader "' + this.options.template + '" didn\'t return html.');
    }

    /**
     * Helper to return a sorted unique array of all asset files out of the
     * asset object
     */
    getAssetFiles(assets) {
        const files = _.uniq(Object.keys(assets).filter(assetType => assetType !== 'chunks' && assets[assetType]).reduce((files, assetType) => files.concat(assets[assetType]), []));
        files.sort();
        return files;
    }

    getAssets(compilation, chunks) {
        const self = this;
        const compilationHash = compilation.hash;
        // Use the configured public path or build a relative path
        let publicPath = typeof compilation.options.output.publicPath !== 'undefined'
            // If a hard coded public path exists use it
            ?
            compilation.mainTemplate.getPublicPath({ hash: compilationHash })
            // If no public path was set get a relative url path
            :
            path.relative(path.resolve(compilation.options.output.path, path.dirname(self.childCompilationOutputName)), compilation.options.output.path)
            .split(path.sep).join('/');

        if (publicPath.length && publicPath.substr(-1, 1) !== '/') {
            publicPath += '/';
        }
        const assets = {
            // The public path
            publicPath: publicPath,
            // Will contain all js & css files by chunk
            chunks: {},
            // Will contain all js files
            js: [],
            // Will contain all css files
            css: [],
            // Will contain the html5 appcache manifest files if it exists
            manifest: Object.keys(compilation.assets).filter(assetFile => path.extname(assetFile) === '.appcache')[0]
        };

        // Append a hash for cache busting
        // if (this.options.hash) {
        //     assets.manifest = self.appendHash(assets.manifest, compilationHash);
        //     assets.favicon = self.appendHash(assets.favicon, compilationHash);
        // }

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkName = chunk.names[0];

            assets.chunks[chunkName] = {};

            // Prepend the public path to all chunk files
            let chunkFiles = [].concat(chunk.files).map(chunkFile => publicPath + chunkFile);

            // Append a hash for cache busting
            if (this.options.hash) {
                chunkFiles = chunkFiles.map(chunkFile => self.appendHash(chunkFile, compilationHash));
            }

            // Webpack outputs an array for each chunk when using sourcemaps
            // or when one chunk hosts js and css simultaneously
            const js = chunkFiles.find(chunkFile => /.js($|\?)/.test(chunkFile));
            if (js) {
                assets.chunks[chunkName].size = chunk.size;
                assets.chunks[chunkName].entry = js;
                assets.chunks[chunkName].hash = chunk.hash;
                assets.js.push(js);
            }

            // Gather all css files
            const css = chunkFiles.filter(chunkFile => /.css($|\?)/.test(chunkFile));
            assets.chunks[chunkName].css = css;
            assets.css = assets.css.concat(css);
        }

        // Duplicate css assets can occur on occasion if more than one chunk
        // requires the same css.
        assets.css = _.uniq(assets.css);
        let keys = Object.keys(compilation.assets);
        // handle copy-webpack-plugin-x
        keys.forEach((item) => {
            let chunkName = compilation.assets[item].key;
            if (chunkName && !assets.chunks[chunkName]) {
                assets.chunks[chunkName] = {
                    entry: publicPath + item,
                    hash: compilation.assets[item].hash,
                    size: compilation.assets[item].size()
                }
            }
        })
        return assets;
    }

    matchRes(html, chunks, publicPath, assets) {
        const scriptReg = /<script.*src=(?:"|')([^'"]+)(?:"|')[^>]*>[\s]*<\/script>/g;
        const linkReg = /<link.*href=(?:"|')([^'"]+)(?:"|')[^\/>]*\/?>/g;
        const context = this.webpackOptions.context;
        const template = this.options.template;

        html = html.replace(linkReg, (match, chunkId) => {

            let pathDir = path.resolve(context, template, '../');

            if (!loaderUtils.isUrlRequest(chunkId, pathDir)) {
                return match;
            }
            let index = chunkId.indexOf('?');
            let entryKey = chunkId;
            let res;

            if (!!~index) {
                entryKey = chunkId.slice(0, index);
                let query = parseQuery(chunkId.slice(index + 1));
                if (query['__inline'] !== undefined) {
                    chunkId = entryKey.replace(/\.css$/, '');
                    res = chunkId;
                    if (chunks[chunkId]) {
                        res = chunks[chunkId].css;
                    }
                    let outputPath = res[0].replace(publicPath, '');
                    return this.inlineRes(constants.STYLE, outputPath, assets);
                }
            }

            chunkId = entryKey.replace(/\.css$/, '');

            res = chunks[chunkId].css;

            res = this.getResPath(constants.SCRIPT, res[0], chunkId);

            return match.replace(new RegExp(entryKey, 'g'), res)
        });

        html = html.replace(scriptReg, (match, chunkId) => {
            let res,
                index = chunkId.indexOf('?'),
                entryKey = chunkId;
            let pathDir = path.resolve(context, template, '../');

            if (!loaderUtils.isUrlRequest(chunkId, pathDir)) {
                return match;
            }
            if (!!~index) {
                entryKey = chunkId.slice(0, index);
                let query = parseQuery(chunkId.slice(index + 1));
                if (query['__inline'] !== undefined) {
                    chunkId = entryKey.replace(/\.js$/, '');
                    res = chunkId;
                    if (chunks[chunkId]) {
                        res = chunks[chunkId].entry;
                    }
                    let outputPath = res.replace(publicPath, '');
                    return this.inlineRes(constants.SCRIPT, outputPath, assets);
                }
            }
            chunkId = entryKey.replace(/\.js$/, '');
            res = (chunks[chunkId] || chunks[entryKey]).entry;
            res = this.getResPath(constants.SCRIPT, res, chunkId);

            res = match.replace(new RegExp(entryKey, 'g'), res);

            return res;
        });
        if (this.options.beforeHtmlEmit) {
            html = this.options.beforeHtmlEmit(this.options.filename, html);
        }


        return html;
    }

    inlineRes(type, outputPath, assets) {
        const context = this.webpackOptions.context;
        const template = this.options.template;
        if (!assets[outputPath]) {

            let filename, filePath;

            if (type == constants.SCRIPT) {
                filename = `${outputPath}.js`;
                filePath = path.resolve(context, template, '../', filename);
                let content = fs.readFileSync(filePath, 'utf-8');
                return '<script>' + content + '</script>';
            } else if (type == constants.STYLE) {
                filename = `${outputPath}.css`;
                filePath = path.resolve(context, template, '../', filename);
                let content = fs.readFileSync(filePath, 'utf-8');
                return '<style>' + content + '</style>';
            }

        } else {
            if (type == constants.SCRIPT) {
                return '<script>' +
                    assets[outputPath].source() +
                    '</script>';
            } else if (type == constants.STYLE) {
                let styles = assets[outputPath].children || [];
                return '<style>' + styles.map((item) => {
                    return item.source();
                }) + '</style>';
            }
        }

    }


    getResPath(type, entry, chunkId) {
        if (type === constants.SCRIPT) {
            return this.options.getPath ?
                this.options.getPath(chunkId, entry) :
                entry;
        }
    }


}

module.exports = HtmlResourceWebpackPlugin;