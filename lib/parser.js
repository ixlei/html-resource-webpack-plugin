const Parser = require("fastparse");

function processCode(match, dep, index) {
    if (/\.js|\.css$/g.test(dep)) {
        this.dep.push({
            index: index,
            dep: dep,
            codeDep: match
        })
    }
    return 'dep';
}

const parser = new Parser({
    code: {
        '[^\+]+': true,
        '\+': 'dep'
    },
    dep: {
        '\\s+': true,
        'require\(([^\)]+)\)': processCode,
        '\+': 'code',
    }
});

module.exports = function(content) {
    return parser.parse('code', content, {
        dep: []
    }).results;
}