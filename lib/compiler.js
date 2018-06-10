'use strict';
const path = require('path');
const NodeTemplatePlugin = require('webpack/lib/node/NodeTemplatePlugin');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
const LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
const LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
// const JsonpTemplatePlugin = require("webpack/lib/web/JsonpTemplatePlugin");
const NodeSourcePlugin = require("webpack/lib/node/NodeSourcePlugin");
const FunctionModulePlugin = require("webpack/lib/FunctionModulePlugin");

const node = {
    console: false,
    process: true,
    global: true,
    Buffer: true,
    setImmediate: true,
    __filename: 'mock',
    __dirname: 'mock',
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
}


function compiler(template, context, outputName, compilation, target) {
    let outputOptions = {
        filename: outputName,
        publicPath: compilation.outputOptions.publicPath
    };
    const assetsBeforeCompilation = Object.assign({}, compilation.assets[outputName]);

    let compilerName = path.resolve(context, outputName);
    let childCompiler = compilation.createChildCompiler(compilerName, outputOptions);
    switch (target) {
        case 'web':
            //new JsonpTemplatePlugin().apply(childCompiler);
            //new FunctionModulePlugin().apply(childCompiler);
            new NodeSourcePlugin(node).apply(childCompiler);
            new LoaderTargetPlugin('web').apply(childCompiler);
            break;
        case 'node':
            // console.log(childCompiler, 'childCompiler')
            // node target
            new NodeTemplatePlugin(outputOptions).apply(childCompiler);
            new NodeTargetPlugin().apply(childCompiler);
            new LoaderTargetPlugin('node').apply(childCompiler);

            // libary output, libasry is HTML_RESOURCE_WEBPACK_PLUGIN_RESULT, 
            // libary target is var
            new LibraryTemplatePlugin('HTML_RESOURCE_WEBPACK_PLUGIN_RESULT', 'var').apply(childCompiler);
            break;
        default:
            throw new Error(`Unsupported target ${target}`);
    }
    // call as singl entry add entry, start compiler
    new SingleEntryPlugin(context, template, outputName).apply(childCompiler);
    return new Promise((resolve, reject) => {
        childCompiler.runAsChild((err, entries, childCompilation) => {
            if (err) {
                reject(err);
                return;
            }

            if (childCompilation && childCompilation.errors && childCompilation.errors.length) {
                let errorMessage = childCompilation.errors.map((error) => {
                    return error.message;
                })
                reject(new Error(errorMessage.join('')));
                return;
            }
            let _outputName = compilation.getPath(outputName, {
                hash: childCompilation.hash,
                chunk: childCompilation.chunks[0]
            });

            compilation.assets[_outputName] = assetsBeforeCompilation[outputName];
            if (assetsBeforeCompilation[_outputName] === undefined) {
                // If it wasn't there - delete it
                delete compilation.assets[_outputName];
            }

            resolve({
                hash: entries[0].hash,
                outputName: outputName,
                content: childCompilation.assets[outputName].source()
            });
        })
    })
}

module.exports = compiler;