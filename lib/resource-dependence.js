/**
 * @file 监控的资源的依赖关系管理
 * @author sparkelwhy@gmial.com
 */

var helper = require('./common/helper');

var resDepMap = {};

function normalizeFilePath(filePath) {
    var server = exports._server;
    if (!server) {
        return filePath;
    }

    if (helper.isAbsolutePath(filePath)) {
        return helper.resolvePath(filePath, server.workingDir);
    }
    return helper.normalizePath(filePath);
}

function formatResPaths(filePaths) {
    return filePaths.map(function (item) {
        return normalizeFilePath(item);
    });
}

exports.addDepInfo = function (resPath, newDepResPaths) {
    resPath = normalizeFilePath(resPath);
    resDepMap[resPath] = formatResPaths(newDepResPaths || []);
};

exports.updateDepInfo = function (resPath, depResPaths) {
    resPath = normalizeFilePath(resPath);

    var deps = resDepMap[resPath] || [];
    resDepMap[resPath] = deps;

    depResPaths.forEach(function (item) {
        item = normalizeFilePath(item);
        if (deps.indexOf(item) === -1) {
            deps.push(item);
        }
    });
};

exports.removeDepInfo = function (resPath) {
    resPath = normalizeFilePath(resPath);
    delete resDepMap[resPath];
};

exports.findResByDep = function (depResPath) {
    var result = [];
    Object.keys(resDepMap).forEach(function (resPath) {
        var deps = resDepMap[resPath];
        if (deps.indexOf(depResPath) !== -1) {
            result.push(resPath);
        }
    });

    return result.length ? result : false;
};

/**
 * 获取要 reload 的文件路径，根据 livereload 选项配置，若未找到，默认 reload 变化的文件路径
 *
 * @param {string} changePath 变化的文件路径
 * @return {string|boolean}
 */
exports.findResByLiveReload = function (changePath) {
    if (!exports._server) {
        return false;
    }

    var livereloadPathMap = exports._server.config.livereload || {};
    for (var path in livereloadPathMap) {
        if (livereloadPathMap.hasOwnProperty(path)) {
            var regex = new RegExp(path);
            if (regex.test(changePath)) {
                return livereloadPathMap[path];
            }
        }

    }

    return false;
};
