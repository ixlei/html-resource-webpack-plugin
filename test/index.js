const path = require('path');

function getFullTemplatePath(template, context) {
    // If the template doesn't use a loader use the lodash template loader
    if (template.indexOf('!') === -1) {
        console.log('---')
        template = require.resolve('html-res-loader') + '!' + path.resolve(context, template);
    }
    console.log(template)
    console.log(context)
        // Resolve template path
    return template.replace(
        /([!])([^/\\][^!?]+|[^/\\!?])($|\?[^!?\n]+$)/,
        (match, prefix, filepath, postfix) => prefix + path.resolve(filepath) + postfix);
}


const res = getFullTemplatePath('html-res-loader!./index.html', path.join(__dirname));
console.log(res);