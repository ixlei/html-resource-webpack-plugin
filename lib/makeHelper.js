'use strict';

const path = require('path');
const loaderUtils = require('loader-utils');

const htmlLoader = require('./loader');

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
            template =
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

    function getOutnameFromPath(pathName) {

        let extname = path.extname(pathName);
        let dirname = path.dirname(pathName);
        let basename = path.basename(pathName, extname);
        pathName = path.join(dirname, basename);
        pathName = pathName.split(path.sep).join('_');
        if (extname) {
            pathName += '_' + extname.slice(1);
        }
        return pathName;
    }

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
        getRequestPath,
        getOutnameFromPath
    }
}



module.exports = makeHelper;