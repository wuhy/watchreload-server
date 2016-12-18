/**
 * @file 文件资源读取响应中间件
 * @author sparklewhy@gmail.com
 */

var url = require('url');
var log = require('../common/log');
var helper = require('../common/helper');

/**
 * 读取文件内容
 *
 * @param {Object} options 选项
 * @param {Function} callback 读取完成执行回调
 */
function readFiles(options, callback) {
    var resFiles = options.resFiles;
    helper.readFiles(resFiles).on(
        'done',
        function (err, data, mtimes) {
            if (err) {
                callback(err);
            }

            var processData = options.processData;
            if (processData) {
                processData(data);
            }
            data = Buffer.concat(data);

            mtimes.sort(function (a, b) {
                return b.getTime() - a.getTime();
            });

            callback(null, {
                mtime: mtimes[0],
                data: data
            });
        }
    );
}

/**
 * 压缩给定的响应数据
 *
 * @param {Object} request 当前的请求
 * @param {Buffer} data 要压缩的数据
 * @return {{encode: ?string, data: Buffer}}
 */
function compressResponseData(request, data) {
    return helper.zip(data, request.headers['accept-encoding'] || '');
}

function responseFile(req, res, options) {
    log.info('Serving files: %j...', req.url);

    if (req.headers['if-modified-since'] || req.headers['if-none-match']) {
        res.writeHead(304);
        res.end();
        return;
    }

    readFiles(options, function (err, result) {
        if (err) {
            log.error('The client script is not found: ' + err.message);
            res.writeHead(404);
            res.end();
            return;
        }

        var data = result.data;
        var expireDate = new Date();
        expireDate.setFullYear(expireDate.getFullYear() + 10);

        var mime = require('mime');
        var responseHeader = {
            'cache-control': 'public, max-age=' + (3600 * 24 * 3650),
            'last-modified': result.mtime.toUTCString(),
            'etag': helper.md5sum(data),
            'expires': expireDate.toUTCString(),
            'content-type': mime.lookup(options.resFiles[0])
        };

        if (options.compress) {
            var compressResult = compressResponseData(req, data);
            var encoding = compressResult.encoding;
            data = compressResult.data;
            encoding && (responseHeader['content-encoding'] = encoding);
        }

        responseHeader['content-length'] = data.length;
        res.writeHead(200, responseHeader);
        res.end(data);
    });
}

/**
 * 请求 watchreload 客户端脚本
 *
 * @param {Object} options 选项信息
 * @param {boolean=} options.compress 是否启用 gzip 压缩，默认 false
 * @param {string} options.reqPath 请求路径
 * @param {Array.<string>} options.resFiles 要响应的文件
 * @param {function(Array.<Buffer>)=} options.processData 预处理读取的数据
 * @return {Function}
 */
function reader(options) {
    var reqPath = options.reqPath;

    return function (req, res, next) {
        var path = req.url || '';
        var urlInfo = url.parse(path, true);
        var pathSegments = urlInfo.pathname.split(/\//);

        var notEmptySegments = [];
        pathSegments.forEach(function (item) {
            item && notEmptySegments.push(item);
        });

        var reqFileName = notEmptySegments[notEmptySegments.length - 1];
        if (reqFileName === reqPath) {
            responseFile(req, res, options);
        }
        else {
            next();
        }
    };
}

module.exports = exports = reader;
