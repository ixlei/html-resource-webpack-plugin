'use strict';

const path = require('path');
const loaderUtils = require('loader-utils');

const htmlLoader = require('./loader');

function makeHelper(webpackContext) {

    function _getLoaderString(loaderContxt, name) {
        return JSON.parse(loaderUtils.stringifyRequest(loaderContxt, require.resolve(name)));
    }


    function getRequestPath(loaderContxt, template, query) {
        if (template.indexOf('!') === -1) {
            template = _getLoaderString(loaderContxt, 'html-res-loader') + '!' +
                _getLoaderString(loaderContxt, './loader') + '!' +
                path.resolve(webpackContext, template) + '?' +
                JSON.stringify(query);
        }
        return template;
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

function trainCaseToCamelCase(word) {
    return word.replace(/-([\w])/g, (match, p1) => p1.toUpperCase());
}

makeHelper.trainCaseToCamelCase = trainCaseToCamelCase;

module.exports = makeHelper;