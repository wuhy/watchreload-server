/**
 * @file 文件相关工具方法
 * @author sparklewhy@gmail.com
 */

var fs = require('fs');
var pathUtil = require('path');

/**
 * 规范化文件路径
 *
 * @param {string} filePath 要规范化的文件路径
 * @return {string}
 */
exports.normalizePath = function (filePath) {
    return filePath.replace(/\\/g, '/');
};

/**
 * 判断给定的路径是否是绝对路径
 *
 * @param {string} filePath 要判断的文件路径
 * @return {boolean}
 */
exports.isAbsolutePath = function (filePath) {
    return pathUtil.isAbsolute(filePath) || /^[a-zA-Z]:/.test(filePath);
};

/**
 * 获取给定文件路径的扩展名称
 *
 * @param  {string} filePath 文件路径
 * @return {string}
 */
exports.getFileExtName = function (filePath) {
    var result = /\.([^\.\/\\]*)$/.exec(filePath);

    if (result && result.length === 2) {
        return result[1];
    }

    return '';

};

/**
 * 给定的文件是否是给定的扩展名类型的文件
 *
 * @param {string} filePath 文件路径
 * @param {string|function ({path: string, extName: string}):boolean} extNames
 *        文件扩展名称，扩展名称以逗号分隔; 或者自定义的文件类型判断方法
 * @return {boolean}
 */
exports.isFileTypeOf = function (filePath, extNames) {
    if (!extNames) {
        return false;
    }

    var fileExtName = exports.getFileExtName(filePath).toLowerCase();
    var paramType = typeof extNames;
    if (paramType === 'string') {
        var extNameArr = extNames.split(',');
        extNameArr.map(function (value) {
            return String(value).trim().toLowerCase();
        });
        return extNameArr.indexOf(fileExtName) !== -1;
    }

    if (paramType === 'function') {
        return extNames({
            path: filePath,
            extName: fileExtName
        });
    }

};

/**
 * 获取文件类型信息，如果给定的文件类型未在 `fileTypes` 里定义，返回的 `type` 为 undefined
 *
 * @param {string} filePath 文件路径
 * @param {Object} fileTypes 文件类型定义，key为文件类型名，value为文件类型定义
 * @return {{ type: string, extName: string }}
 * @exampe
 *      getFileTypeInfo('a/b.js', { script: 'js', css: 'less,css' })
 *      // output: { type: 'script', extName: 'js' }
 */
exports.getFileTypeInfo = function (filePath, fileTypes) {
    var fileType;
    for (var type in fileTypes) {
        if (fileTypes.hasOwnProperty(type)) {
            if (exports.isFileTypeOf(filePath, fileTypes[type])) {
                fileType = type;
                break;
            }
        }

    }

    return {
        type: fileType,
        extName: exports.getFileExtName(filePath)
    };
};

/**
 * 获取给定的完整路径相对于当前执行目录的相对路径，同时将路径里的 `\` 转成 `/`
 *
 * @param {string=} basePath 要相对的基路径，可选，默认基于当前工作目录
 * @param {string} filePath 文件路径
 * @return {string}
 */
exports.getRelativePath = function (basePath, filePath) {
    if (arguments.length === 1) {
        filePath = basePath;
        basePath = null;
    }

    basePath || (basePath = process.cwd());

    var result = pathUtil.relative(
        basePath, pathUtil.resolve(filePath)
    );
    return exports.normalizePath(result);
};

/**
 * 将给定的 filePath 规范化为绝对路径
 *
 * @param {string} filePath 要获取绝对路径的原始路径
 * @param {string=} basePath 要相对的基路径，可选，默认基于当前工作目录
 * @return {string}
 */
exports.resolvePath = function (filePath, basePath) {
    var result = basePath
        ? pathUtil.resolve(basePath, filePath)
        : pathUtil.resolve(filePath);
    return exports.normalizePath(result);
};

/**
 * 读取文件内容，支持读取多个文件，读取完成，将触发 `done`
 * 事件，若读取成功将返回所有文件内容数组，顺序同传入的文件
 * 顺序，若有个文件读取失败，将结束文件读取。
 *
 * @param  {string|Array.<string>} files 要读取的文件路径
 * @return {event.EventEmitter}
 * @example
 *     readFiles(['a/b.js', 'a/c.js']).on('done', function (err, data) {
 *         if (err) {
 *             console.log(err);
 *         }
 *         else {
 *             // data is array
 *         }
 *     });
 */
exports.readFiles = function (files) {
    if (!Array.isArray(files)) {
        files = [
            files
        ];
    }

    var processNum = files.length;
    var EventEmitter = require('events').EventEmitter;
    var emitter = new EventEmitter();
    var result = [];
    var fileIdxMap = {};
    var doneNum = 0;
    var modTimes = [];
    files.forEach(function (filePath, idx) {
        fileIdxMap[filePath] = idx;

        fs.readFile(filePath, function (err, data) {
            if (!emitter) {
                return;
            }

            if (err) {
                emitter.emit('done', err);
                result = null;
                emitter = null;
                return;
            }

            var stat = fs.statSync(filePath);
            modTimes.push(stat.mtime);

            result[fileIdxMap[filePath]] = data;
            doneNum++;

            if (doneNum === processNum) {
                emitter.emit('done', null, result, modTimes);
                result = null;
                emitter = null;
            }

        });
    });

    return emitter;
};

/**
 * 计算给定的数据的 md5 摘要
 *
 * @param {Buffer} data 数据
 * @return {string}
 */
exports.md5sum = function (data) {
    var crypto = require('crypto');
    var md5 = crypto.createHash('md5');
    md5.update(data);

    return md5.digest('hex');
};

/**
 * 对给定的数据进行压缩
 *
 * @param {Buffer} data 要压缩的数据
 * @param {string} contentEncoding 要压缩的编码
 * @return {{encoding: ?string, data: Buffer}}
 */
exports.zip = function (data, contentEncoding) {
    var encoding = null;
    var zlib = require('zlib');
    contentEncoding || (contentEncoding = '');
    if (contentEncoding.match(/\bgzip\b/)) {
        encoding = 'gzip';
        data = zlib.gzipSync(data);
    }
    else if (contentEncoding.match(/\bdeflate\b/)) {
        encoding = 'deflate';
        data = zlib.deflateSync(data);
    }

    return {
        encoding: encoding,
        data: data
    };
};

/**
 * 解压缩数据
 *
 * @param {Buffer} data 要解压的数据
 * @param {string} contentEncoding 解压的数据使用的编码
 * @return {{encoding: ?string, data: Buffer}}
 */
exports.unzip = function (data, contentEncoding) {
    var zlib = require('zlib');

    if (contentEncoding === 'gzip' || contentEncoding === 'deflate') {
        contentEncoding = null;
        data = zlib.unzipSync(data);
    }

    return {
        encoding: contentEncoding,
        data: data
    };
};
