'use strict';

const path = require('path');
const loaderUtils = require('loader-utils');

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

module.exports = makeHelper;