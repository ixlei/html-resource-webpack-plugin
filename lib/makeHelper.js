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

    return {
        getRequestPath
    }
}

module.exports = makeHelper;