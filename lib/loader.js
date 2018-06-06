const loaderUtils = require('loader-utils');

function htmlLoader(content) {
    this.cacheable && this.cacheable();
    let resQuery = loaderUtils.parseQuery(this.resourceQuery);
    let requestList = resQuery;
    let res = [];
    for (let i = requestList.length - 1; i > 0; i--) {
        let start = requestList[i].start + requestList[i].length;
        let endTag = new RegExp(`<\\/${requestList[i].tag}[^>]*>`);
        let subStr = this.content.substring(start);
        let endTagIndex = subStr.search(endTag);
        let substring = content.substring(endTagIndex);
        res.unshift(substring);
        res.unshift(JSON.stringify(`htmlWebpackPluginInline${start}`));
        content = content.substring(0, endTagIndex);
    }
    return res.join('');
}

module.exports = htmlLoader;