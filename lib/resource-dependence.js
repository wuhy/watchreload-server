/**
 * @file 监控的资源的依赖关系管理
 * @author sparkelwhy@gmial.com
 */

var resDepMap = {};

exports.addDepInfo = function (resPath, newDepResPaths) {
    resDepMap[resPath] = newDepResPaths || [];
};

exports.updateDepInfo = function (resPath, depResPaths) {
    var deps = resDepMap[resPath] || [];
    resDepMap[resPath] = deps;

    depResPaths.forEach(function (item) {
        if (deps.indexOf(item) === -1) {
            deps.push(item);
        }
    });
};

exports.removeDepInfo = function (resPath) {
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
 * @param {Object} livereloadPathMap 定义的 livereload 的路径变化映射关系
 * @return {string|boolean}
 */
exports.findResByLiveReload = function (changePath, livereloadPathMap) {
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
