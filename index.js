'use strict';

const path = require('path');
const objectAssign = require('object-assign');
const childCompiler = require('./lib/compiler');
const makeHelper = require('./lib/makeHelper');

class HtmlResourceWebpackPlugin {
    constructor(options = {}) {
        this.options = objectAssign({}, {
            template: path.resolve(__dirname, 'default-index.html'),
            filename: 'index.html'
        }, options);
    }

    apply(compiler) {
        const context = compiler.context;
        const template = this.options.template;
        const filename = this.options.filename;
        const {
            getRequestPath
        } = makeHelper(context);

        let makeHookCallback = (compilation, callback) => {
            childCompiler(template, context, filename, getRequestPath(this, template))
        }

        if (compiler.hooks) {
            compiler.hooks.make.tapAsync('htmlResourcePlugin', makeHookCallback)
        }
    }


}