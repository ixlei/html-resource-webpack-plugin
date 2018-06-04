'use strict';

const path = require('path');
const loaderUtils = require('loader-utils');
const {
    NodeJsInputFileSystem,
    CachedInputFileSystem,
    ResolverFactory
} = require('enhanced-resolve');

function makeHelper(webpackContext) {

    function _getLoaderString(loaderContxt) {
        return JSON.parse(loaderUtils.stringifyRequest(loaderContxt, require.resolve('html-res-loader')));
    }


    function getRequestPath(loaderContxt, template) {
        if (template.indexOf('!') === -1) {
            template = _getLoaderString(loaderContxt) +
                '!' +
                path.resolve(webpackContext, template);
        }
        return template.replace(
            /([!])([^/\\][^!?]+|[^/\\!?])($|\?[^!?\n]+$)/,
            (match, prefix, filepath, postfix) => prefix + path.resolve(filepath) + postfix);
    }

    function getScriptRequire(loaderContxt, template) {
        if (template.indexOf('!') === -1) {
            template = JSON.parse(loaderUtils.stringifyRequest(loaderContxt, require.resolve('babel-loader'))) +
                '!' +
                path.resolve(webpackContext, template);
        }
        return template.replace(
            /([!])([^/\\][^!?]+|[^/\\!?])($|\?[^!?\n]+$)/,
            (match, prefix, filepath, postfix) => prefix + path.resolve(filepath) + postfix);
    }

    const constants = {
        'SCRIPT': 'SCRIPT',
        'STYLE': 'STYLE'
    };

    function parseQuery(str) {
        const regExp = /([^=&]+)=?([^&=]*)/g;
        let item = null,
            res = {};
        while (item = regExp.exec(str)) {
            res[item[1]] = item[2];
        }
        return res;
    }


    return {
        constants,
        parseQuery,
        getScriptRequire,
        getRequestPath
    }
}

function getRequirePath(pathName) {

}



// create a resolver
const myResolver = ResolverFactory.createResolver({
    // Typical usage will consume the `NodeJsInputFileSystem` + `CachedInputFileSystem`, which wraps the Node.js `fs` wrapper to add resilience + caching.
    fileSystem: new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000),
    /* any other resolver options here. Options/defaults can be seen below */
});

// resolve a file with the new resolver
const context = {};
const resolveContext = {};
const lookupStartPath = '/Users/webpack/some/root/dir';
const request = './path/to-look-up.js';
myResolver.resolve({}, lookupStartPath, request, resolveContext, (err /*Error*/ , filepath /*string*/ ) => {
    // Do something with the path
});

module.exports = makeHelper;