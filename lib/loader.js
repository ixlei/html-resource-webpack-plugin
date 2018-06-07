const loaderUtils = require('loader-utils');

function htmlLoader(content) {
    this.cacheable && this.cacheable();
    let resQuery = loaderUtils.parseQuery(this.resourceQuery);
    let requestList = resQuery.requestList;
    let res = [];
    for (let i = requestList.length - 1; i >= 0; i--) {
        let start = requestList[i].start + requestList[i].length;

        let endTag = new RegExp(`<\\/${requestList[i].tag}[^>]*>`);
        let subStr = content.substring(start);
        let endTagIndex = subStr.search(endTag);
        let substring = subStr.substring(endTagIndex);
        res.unshift(substring);
        res.unshift(JSON.stringify(`htmlWebpackPluginInline${start}`));
        res.unshift(subStr.substring(0, endTagIndex))
        content = content.substring(0, start);
    }
    res.unshift(content);
    return res.join('');
}

module.exports = htmlLoader;