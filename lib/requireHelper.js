const {
    NodeJsInputFileSystem,
    CachedInputFileSystem,
    ResolverFactory
} = require('enhanced-resolve');

class RequireHelper {
    constructor(options = {}) {
        options = Object.assign({
            useSyncFileSystemCalls: true,
            fileSystem: new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000),
        }, options);

        this.resolver = ResolverFactory.createResolver(options);
    }
    getPath(lookupStartPath, request) {
        return this.resolver.resolveSync({}, lookupStartPath, request);
        // return new Promise((resolve, reject) => {
        //     this.resolver.resolve({}, lookupStartPath, request, {}, (err, filepath) => {
        //         if (err) {
        //             return reject(err);
        //         }
        //         resolve(filepath);
        //     })
        // })
    }
    static getResolveConfig(webpackConfig) {
        const resolve = webpackConfig.resolve || {};
        return Object.assign({}, {
            'alias': [],
            'aliasFields': [],
            'cacheWithContext': true,
            'descriptionFiles': ["package.json"],
            'enforceExtension': false,
            'enforceModuleExtension': false,
            'extensions': [".js", ".json", ".node"],
            'mainFields': ["main"],
            'mainFiles': ["index"],
            'modules': ["node_modules"]
        }, resolve)
    }
}

module.exports = RequireHelper;