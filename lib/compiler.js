'use strict';
const path = require('path');
const NodeTemplatePlugin = require('webpack/lib/node/NodeTemplatePlugin');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
const LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
const LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

function compiler(template, context, outputName, compilation) {
    let outputOptions = {
        filename: outputName,
        publicPath: compilation.outputOptions.publicPath
    };

    let compilerName = path.resolve(context, outputName);
    let childCompiler = compilation.createChildCompiler(compilerName, outputOptions);
    // console.log(childCompiler, 'childCompiler')
    // node target
    new NodeTemplatePlugin(outputOptions).apply(childCompiler);
    new NodeTargetPlugin().apply(childCompiler);
    new LoaderTargetPlugin('node').apply(childCompiler);

    // libary output, libasry is HTML_RESOURCE_WEBPACK_PLUGIN_RESULT, 
    // libary target is var
    new LibraryTemplatePlugin('HTML_RESOURCE_WEBPACK_PLUGIN_RESULT', 'var').apply(childCompiler);

    // call as singl entry add entry, start compiler
    new SingleEntryPlugin(context, template, outputName).apply(childCompiler);
    childCompiler.runAsChild((err, entries, compilation) => {
        console.log(compilation.assets['index.html'].source())
    })

}

module.exports = compiler;