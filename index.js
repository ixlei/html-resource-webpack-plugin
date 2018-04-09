'use strict';

const path = require('path');
const objectAssign = require('object-assign');
const childCompiler = require('./lib/compiler');
const makeHelper = require('./lib/makeHelper');
const vm = require('vm');
const _ = require('lodash');

class HtmlResourceWebpackPlugin {
    constructor(options = {}) {
        this.options = objectAssign({}, {
            template: path.resolve(__dirname, 'default-index.html'),
            filename: 'index.html'
        }, options);
    }

    apply(compiler) {
        const self = this;
        const context = compiler.context;
        const template = this.options.template;
        const filename = this.options.filename;
        let childCompilation = null;
        let isCompilationCached = false;
        const {
            getRequestPath
        } = makeHelper(context);
        let makeHookCallback = (compilation, callback) => {
            childCompilation = childCompiler(getRequestPath(this, template), context, filename, compilation).catch((err) => {
                console.log(err)
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
                    compilation.assets[self.childCompilationOutputName] = {
                        source: () => html,
                        size: () => html.length
                    };
                    callback();
                })
                .catch((err) => {
                    console.log(err)
                })

        }

        if (compiler.hooks) {
            compiler.hooks.make.tapAsync('htmlResourcePlugin', makeHookCallback);
            compiler.hooks.emit.tapAsync('htmlResourcePlugin', makeEmitHookCallback);
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

        return assets;
    }


}

module.exports = HtmlResourceWebpackPlugin;