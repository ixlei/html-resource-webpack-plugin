'use strict';

const vm = require('vm');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const loaderUtils = require('loader-utils');
const resolveFrom = require('resolve-from');
const objectAssign = require('object-assign');
const htmlMinifier = require('html-minifier');

const parser = require('./lib/parser');
const prettyError = require('./lib/error.js');
const makeHelper = require('./lib/makeHelper');
const childCompiler = require('./lib/compiler');
const RequireHelper = require('./lib/requireHelper');

const trainCaseToCamelCase = makeHelper.trainCaseToCamelCase;

let constants = require('./lib/constants');

function loop() {}
let parseQuery = loop;

class HtmlResourceWebpackPlugin {
    constructor(options = {}) {
        this.options = objectAssign({}, {
            template: path.resolve(__dirname, 'default-index.html'),
            filename: 'index.html',
            reqAttr: ['script:data-src'],
            chunks: [],
            meta: false,
            excludedChunks: []
        }, options);

        this.webpackOptions = {};
        this.reqList = this.getReqList();
        this.resolver = null;

    }

    getReqList() {
        const { reqAttr, template } = this.options;

        let content = fs.readFileSync(template, 'utf-8');

        function isNeedRequire(tag, name, _defaultTag = reqAttr) {
            return _defaultTag.some((item) => {
                return `${tag}:${name}` == item.trim();
            });
        }

        const res = parser(content, function(type, tag, name) {
            if (type == constants.ATTR) {
                return isNeedRequire(tag, name);
            }
            return !!~reqAttr.indexOf(tag);
        });
        return res;
    }

    initResolver() {
        const webpackOptions = this.webpackOptions;
        let resolveParams = RequireHelper.getResolveConfig(webpackOptions);
        this.resolver = new RequireHelper(resolveParams);
    }


    getDependenceResolver(lookupStartPath) {
        return this.reqList.map((item) => {
            let request = this.resolver.getPath(lookupStartPath, item.value);
            item.request = request;
            return request;
        });
    }


    apply(compiler) {
        const self = this;
        const context = compiler.context;
        const template = this.options.template;
        const script = this.options.script;

        const filename = this.options.filename;
        const basename = path.basename(filename, path.extname(filename));

        let childCompilation = null;
        let webChildCompilation = null;

        let webChildCompilationList = [];

        let isCompilationCached = false;

        if (compiler.hooks) {
            compiler.hooks.compilation.tap('HtmlWebpackPluginHooks', compilation => {
                const SyncWaterfallHook = require('tapable').SyncWaterfallHook;
                const AsyncSeriesWaterfallHook = require('tapable').AsyncSeriesWaterfallHook;
                compilation.hooks.htmlWebpackPluginAlterChunks = new SyncWaterfallHook(['chunks', 'objectWithPluginRef']);
                compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration = new AsyncSeriesWaterfallHook(['pluginArgs']);
                compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing = new AsyncSeriesWaterfallHook(['pluginArgs']);
                compilation.hooks.htmlWebpackPluginAlterAssetTags = new AsyncSeriesWaterfallHook(['pluginArgs']);
                compilation.hooks.htmlWebpackPluginAfterHtmlProcessing = new AsyncSeriesWaterfallHook(['pluginArgs']);
                compilation.hooks.htmlWebpackPluginAfterEmit = new AsyncSeriesWaterfallHook(['pluginArgs']);
            });
        }

        const helper = makeHelper(context);
        const getRequestPath = helper.getRequestPath;
        const getScriptRequire = helper.getScriptRequire;
        const getOutnameFromPath = helper.getOutnameFromPath;

        constants = Object.assign({}, constants, helper.constants);
        parseQuery = helper.parseQuery;

        this.webpackOptions = compiler.options;

        this.initResolver();

        let lookupStartPath = path.dirname(template);
        this.resolverList = this.getDependenceResolver(lookupStartPath);

        let makeHookCallback = (compilation, callback) => {
            childCompilation = childCompiler(getRequestPath(this, template, {
                requestList: this.reqList
            }), context, filename, compilation, 'node').catch((err) => {
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

        const getDependenceHookCallback = (request, filename) => {
            filename = getOutnameFromPath(filename);
            return (compilation, callback) => {
                webChildCompilationList.push(childCompiler(getScriptRequire(this, request), context, filename, compilation, 'web').catch((err) => {
                    compilation.errors.push(prettyError(err, compiler.context).toString());
                    return {
                        content: this.options.showErrors ? prettyError(err, compiler.context).toJsonHtml() : 'ERROR',
                        outputName: filename
                    };
                }).then((compilationResult) => {
                    callback();
                    return compilationResult.content;
                }));
            }
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
            let chunks = allChunks;

            const assets = this.getAssets(compilation, chunks);
            // If the template and the assets did not change we don't have to emit the html
            const assetJson = JSON.stringify(this.getAssetFiles(assets));
            if (isCompilationCached && self.options.cache && assetJson === self.assetJson) {
                return callback();
            } else {
                self.assetJson = assetJson;
            }

            const applyPluginsAsyncWaterfall = this.applyPluginsAsyncWaterfall(compilation);

            if (compilation.hooks) {
                chunks = compilation.hooks.htmlWebpackPluginAlterChunks.call(chunks, { plugin: this });
            } else {
                chunks = compilation.applyPluginsWaterfall('html-webpack-plugin-alter-chunks', chunks, { plugin: this });
            }

            let _depCompilationTemplate = [];
            Promise.all([].concat(childCompilation, webChildCompilationList))
                .then(([childCompilationTemplate, ...depCompilationTemplate]) => {
                    _depCompilationTemplate = depCompilationTemplate;
                    return this.evaluateCompilationResult(compilation, childCompilationTemplate);
                })
                .then((html) => {
                    return this.injectDepenResource(html, _depCompilationTemplate)
                })
                .then((html) => {
                    return this.matchRes(
                        html,
                        assets.chunks,
                        assets.publicPath,
                        compilation.assets);
                })
                .then((html) => {
                    return this.minifyHtml(html, this.options.minify)
                })
                .then(compilationResult => applyPluginsAsyncWaterfall('html-webpack-plugin-before-html-generation', false, {
                        assets: assets,
                        outputName: self.childCompilationOutputName,
                        plugin: self
                    })
                    .then(() => compilationResult))
                .then(compilationResult => typeof compilationResult !== 'function' ?
                    compilationResult :
                    this.executeTemplate(compilationResult, chunks, assets, compilation))
                .then(html => {
                    const pluginArgs = { html: html, assets: assets, plugin: self, outputName: self.childCompilationOutputName };
                    return applyPluginsAsyncWaterfall('html-webpack-plugin-before-html-processing', true, pluginArgs);
                })
                .then(result => {
                    const html = result.html;
                    const assets = result.assets;
                    // Prepare script and link tags
                    const assetTags = self.generateHtmlTags(assets);
                    const pluginArgs = { head: assetTags.head, body: assetTags.body, plugin: self, chunks: chunks, outputName: self.childCompilationOutputName };
                    // Allow plugins to change the assetTag definitions
                    return applyPluginsAsyncWaterfall('html-webpack-plugin-alter-asset-tags', true, pluginArgs)
                        .then(result => self.postProcessHtml(html, assets, { body: result.body, head: result.head })
                            .then(html => _.extend(result, { html: html, assets: assets })));
                })
                // Allow plugins to change the html after assets are injected
                .then(result => {
                    const html = result.html;
                    const assets = result.assets;
                    const pluginArgs = { html: html, assets: assets, plugin: self, outputName: self.childCompilationOutputName };
                    return applyPluginsAsyncWaterfall('html-webpack-plugin-after-html-processing', true, pluginArgs)
                        .then(result => result.html);
                })
                .then((html) => {
                    compilation.assets[self.childCompilationOutputName] = {
                        source: () => html,
                        size: () => html.length
                    };
                    callback();
                })
                .then(() => applyPluginsAsyncWaterfall('html-webpack-plugin-after-emit', false, {
                    html: compilation.assets[self.childCompilationOutputName],
                    outputName: self.childCompilationOutputName,
                    plugin: this
                }))
                .catch((err) => {
                    compilation.errors.push(prettyError(err, compiler.context).toString());
                    // Prevent caching
                    this.hash = null;
                    return this.options.showErrors ? prettyError(err, compiler.context).toHtml() : 'ERROR';
                }).then(() => null)
                .then(() => {
                    callback();
                })

        }

        if (compiler.hooks) {
            compiler.hooks.make.tapAsync('htmlResourcePlugin', makeHookCallback);
            //compiler.hooks.make.tapAsync('hemlResourceScriptPlugin', webMakeHookCallback);
            this.resolverList.forEach((item, index) => {
                compiler.hooks.make.tapAsync(`${basename}ScriptHtmlResourcePlugin${index}`,
                    getDependenceHookCallback(getScriptRequire(this, item), item))
            })
            compiler.hooks.emit.tapAsync('htmlResourcePlugin', makeEmitHookCallback);
        } else {
            compiler.plugin('make', makeHookCallback);
            this.resolverList.forEach((item, index) => {
                compiler.plugin('make',
                    getDependenceHookCallback(getScriptRequire(this, item), item))
            })
            compiler.plugin('emit', makeEmitHookCallback);
        }
    }

    injectDepenResource(content, dependencies) {
        let requestList = this.reqList;
        return requestList.reduce((content, item, index) => {
            let start = item.start + item.length;
            let placeholderContent = JSON.stringify(`htmlWebpackPluginInline${start}`);
            let placeholderRegexp = new RegExp(placeholderContent);
            return content.replace(placeholderRegexp, dependencies[index]);
        }, content);
    }

    getMetaTags() {
        if (this.options.meta === false) {
            return [];
        }
        // Make tags self-closing in case of xhtml
        // Turn { "viewport" : "width=500, initial-scale=1" } into
        // [{ name:"viewport" content:"width=500, initial-scale=1" }]
        const selfClosingTag = !!this.options.xhtml;
        const metaTagAttributeObjects = Object.keys(this.options.meta).map((metaName) => {
            const metaTagContent = this.options.meta[metaName];
            return (typeof metaTagContent === 'object') ? metaTagContent : {
                name: metaName,
                content: metaTagContent
            };
        });
        // Turn [{ name:"viewport" content:"width=500, initial-scale=1" }] into
        // the html-webpack-plugin tag structure
        return metaTagAttributeObjects.map((metaTagAttributes) => {
            return {
                tagName: 'meta',
                voidTag: true,
                selfClosingTag: selfClosingTag,
                attributes: metaTagAttributes
            };
        });
    }

    generateHtmlTags(assets) {
        // Turn script files into script tags
        const scripts = assets.js.map(scriptPath => ({
            tagName: 'script',
            closeTag: true,
            attributes: {
                type: 'text/javascript',
                src: scriptPath
            }
        }));
        // Make tags self-closing in case of xhtml
        const selfClosingTag = !!this.options.xhtml;
        // Turn css files into link tags
        const styles = assets.css.map(stylePath => ({
            tagName: 'link',
            selfClosingTag: selfClosingTag,
            voidTag: true,
            attributes: {
                href: stylePath,
                rel: 'stylesheet'
            }
        }));
        // Injection targets
        let head = this.getMetaTags();
        let body = [];

        // If there is a favicon present, add it to the head
        if (assets.favicon) {
            head.push({
                tagName: 'link',
                selfClosingTag: selfClosingTag,
                voidTag: true,
                attributes: {
                    rel: 'shortcut icon',
                    href: assets.favicon
                }
            });
        }
        // Add styles to the head
        head = head.concat(styles);
        // Add scripts to body or head
        if (this.options.inject === 'head') {
            head = head.concat(scripts);
        } else {
            body = body.concat(scripts);
        }
        return { head: head, body: body };
    }

    postProcessHtml(html, assets, assetTags) {
        if (typeof html !== 'string') {
            return Promise.reject('Expected html to be a string but got ' + JSON.stringify(html));
        }
        return Promise.resolve()
            // Inject
            .then(() => {
                if (this.options.inject) {
                    return this.injectAssetsIntoHtml(html, assets, assetTags);
                } else {
                    return html;
                }
            })
    }

    injectAssetsIntoHtml(html, assets, assetTags) {
        const htmlRegExp = /(<html[^>]*>)/i;
        const headRegExp = /(<\/head\s*>)/i;
        const bodyRegExp = /(<\/body\s*>)/i;
        const body = assetTags.body.map(this.createHtmlTag.bind(this));
        const head = assetTags.head.map(this.createHtmlTag.bind(this));

        if (body.length) {
            if (bodyRegExp.test(html)) {
                // Append assets to body element
                html = html.replace(bodyRegExp, match => body.join('') + match);
            } else {
                // Append scripts to the end of the file if no <body> element exists:
                html += body.join('');
            }
        }

        if (head.length) {
            // Create a head tag if none exists
            if (!headRegExp.test(html)) {
                if (!htmlRegExp.test(html)) {
                    html = '<head></head>' + html;
                } else {
                    html = html.replace(htmlRegExp, match => match + '<head></head>');
                }
            }

            // Append assets to head element
            html = html.replace(headRegExp, match => head.join('') + match);
        }

        // Inject manifest into the opening html tag
        if (assets.manifest) {
            html = html.replace(/(<html[^>]*)(>)/i, (match, start, end) => {
                // Append the manifest only if no manifest was specified
                if (/\smanifest\s*=/.test(match)) {
                    return match;
                }
                return start + ' manifest="' + assets.manifest + '"' + end;
            });
        }
        return html;
    }

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


    minifyHtml(content, minimizeOptions) {
        minimizeOptions = typeof minimizeOptions !== "undefined" ?
            minimizeOptions : {
                "minifyJS": true,
                "minifyCSS": true,
                "removeScriptTypeAttributes": true,
                "removeStyleTypeAttributes": true
            };

        return content = htmlMinifier.minify(content, minimizeOptions);
    }

    executeTemplate(templateFunction, chunks, assets, compilation) {
        return Promise.resolve()
            // Template processing
            .then(() => {
                const templateParams = this.getTemplateParameters(compilation, assets);
                let html = '';
                try {
                    html = templateFunction(templateParams);
                } catch (e) {
                    compilation.errors.push(new Error('Template execution failed: ' + e));
                    return Promise.reject(e);
                }
                return html;
            });
    }

    getTemplateParameters(compilation, assets) {
        if (typeof this.options.templateParameters === 'function') {
            return this.options.templateParameters(compilation, assets, this.options);
        }
        if (typeof this.options.templateParameters === 'object') {
            return this.options.templateParameters;
        }
        return {};
    }


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

    applyPluginsAsyncWaterfall(compilation) {
        if (compilation.hooks) {
            return (eventName, requiresResult, pluginArgs) => {
                const ccEventName = trainCaseToCamelCase(eventName);
                if (!compilation.hooks[ccEventName]) {
                    compilation.errors.push(
                        new Error('No hook found for ' + eventName)
                    );
                }

                return compilation.hooks[ccEventName].promise(pluginArgs);
            };
        }

        const promisedApplyPluginsAsyncWaterfall = function(name, init) {
            return new Promise((resolve, reject) => {
                const callback = function(err, result) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                };
                compilation.applyPluginsAsyncWaterfall(name, init, callback);
            });
        };

        return (eventName, requiresResult, pluginArgs) => promisedApplyPluginsAsyncWaterfall(eventName, pluginArgs)
            .then(result => {
                if (requiresResult && !result) {
                    compilation.warnings.push(
                        new Error('Using ' + eventName + ' without returning a result is deprecated.')
                    );
                }
                return _.extend(pluginArgs, result);
            });
    }


    filterChunks(chunks, includedChunks, excludedChunks) {
        return chunks.filter(chunk => {
            const chunkName = chunk.names[0];
            if (chunkName === undefined) {
                return false;
            }
            // Skip if the chunk should be lazy loaded, example require.ensure
            if (typeof chunk.isInitial === 'function') {
                if (!chunk.isInitial()) {
                    return false;
                }
            } else if (!chunk.initial) {
                return false;
            }
            if (Array.isArray(includedChunks) && includedChunks.indexOf(chunkName) === -1) {
                return false;
            }
            if (Array.isArray(excludedChunks) && excludedChunks.indexOf(chunkName) !== -1) {
                return false;
            }
            return true;
        });
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
                    res = [chunkId];
                    if (chunks[chunkId]) {
                        res = chunks[chunkId].css;
                    }
                    if (!Array.isArray(res) || res.length == 0) {
                        return match;
                    }
                    let outputPath = res[0].replace(publicPath, '');
                    return this.inlineRes(constants.STYLE, outputPath, assets, entryKey);
                }
            }

            chunkId = entryKey.replace(/\.css$/, '');

            res = chunks[chunkId].css;
            if (!Array.isArray(res) || res.length == 0) {
                return match;
            }
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
                    return this.inlineRes(constants.SCRIPT, outputPath, assets, entryKey);
                }
            }
            chunkId = entryKey.replace(/\.js$/, '');
            res = (chunks[chunkId] || chunks[entryKey]);
            if (!res) {
                return match;
            }
            res = res.entry;
            res = this.getResPath(constants.SCRIPT, res, chunkId);

            res = match.replace(new RegExp(entryKey, 'g'), res);

            return res;
        });
        if (this.options.beforeHtmlEmit) {
            html = this.options.beforeHtmlEmit(this.options.filename, html, chunks);
        }


        return html;
    }

    inlineRes(type, outputPath, assets, entryKey) {
        const context = this.webpackOptions.context;
        const template = this.options.template;
        if (!assets[outputPath]) {

            let filename, filePath;
            filename = entryKey;
            filePath = resolveFrom(path.resolve(context, template, '../'), filename);
            let content = fs.readFileSync(filePath, 'utf-8');
            if (type == constants.SCRIPT) {
                return '<script>' + content + '</script>';
            } else if (type == constants.STYLE) {
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
                }).join('') + '</style>';
            }
        }

    }


    getResPath(type, entry, chunkId) {
        //if (type === constants.SCRIPT) {
        return this.options.getPath ?
            this.options.getPath(chunkId, entry) :
            entry;
        //}
    }

}

module.exports = HtmlResourceWebpackPlugin;