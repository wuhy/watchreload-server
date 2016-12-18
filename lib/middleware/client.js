/**
 * @file 处理请求 watchreload 客户端脚本的中间件
 * @author sparklewhy@gmail.com
 */

var pathUtil = require('path');
var helper = require('../common/helper');
var reader = require('./reader');

/**
 * 默认的客户端脚本文件
 *
 * @type {string}
 * @const
 */
var DEFAULT_CLIENT_SCRIPT = helper.resolve('watchreload.js/dist/watchreload', [
    pathUtil.join(__dirname, '../../node_modules')
]).replace(/\.js$/, '');

/**
 * socket.io客户端脚本文件
 *
 * @type {string}
 * @const
 */
var SOCKET_IO_CLIENT_SCRIPT = helper.resolve('socket.io-client/dist/socket.io', [
    pathUtil.join(__dirname, '../../node_modules/socket.io/node_modules')
]).replace(/\.js$/, '');

/**
 * 重写socket.io客户端脚本：强行设置socket.io客户端端执行环境不具备amd模块定义，确保socket.io
 * 能在客户端作为普通的脚本引用。否则会影响其它模块的require的初始化。
 *
 * @param {string} script 脚本
 * @return {Buffer}
 */
function rewriteSocketIOClientScript(script) {
    var resetAmdScript = ''
        + 'if (typeof define === "function" && define.amd) {'
        +     'define.resetAmd = true; define.amd = false; '
        + '}';
    var recoverAmdScript = ''
        + 'if (typeof define === "function" && define.resetAmd) {'
        +     'delete define.resetAmd; define.amd = true; '
        + '}';

    return new Buffer(resetAmdScript + '\n' + script + '\n' + recoverAmdScript);
}

/**
 * 重写浏览器客户端的reload脚本
 *
 * @param {string} script 脚本
 * @param {Object} options 选项信息
 * @return {Buffer}
 */
function rewriteBrowserReloadScript(script, options) {
    return new Buffer('\n' + script.replace(
        /\{\{socketUrl\}\}/g, options.url
    ));
}

/**
 * 获取要加载的客户端脚本路径
 *
 * @param {Object} options 选项
 * @return {Array.<string>}
 */
function getClientScriptPaths(options) {
    var basePath = options.basePath;
    var clientScriptPath = options.path;
    var isDebug = options.debug;
    var suffix = isDebug ? '.js' : '.min.js';

    if (clientScriptPath) {
        clientScriptPath = helper.resolvePath(
            clientScriptPath, basePath
        );
    }
    else {
        clientScriptPath = DEFAULT_CLIENT_SCRIPT + suffix;
    }

    var scriptPaths = [
        SOCKET_IO_CLIENT_SCRIPT + suffix,
        clientScriptPath
    ];
    var clientPlugins = options.plugins || [];
    clientPlugins.forEach(function (plugin) {
        scriptPaths.push(helper.resolvePath(plugin, basePath));
    });

    return scriptPaths;
}

/**
 * 请求 watchreload 客户端脚本
 *
 * @param {Object} options 选项信息
 * @param {string} options.url 客户端请求的 url
 * @param {string} options.name 客户端脚本名称
 * @param {string=} options.path 自定义的客户端脚本路径，可选
 * @param {string=} options.basePath 相对的基路径，可选
 * @param {Array.<string>=} options.plugins 自定义的客户端插件路径列表，可选
 * @return {Function}
 */
function requestWatchreloadClient(options) {
    return reader({
        compress: true,
        reqPath: options.name,
        resFiles: getClientScriptPaths(options),
        processData: function (data) {
            data[0] = rewriteSocketIOClientScript(data[0].toString('utf8'));
            data[1] = rewriteBrowserReloadScript(data[1].toString('utf8'), options);
        }
    });
}

module.exports = exports = requestWatchreloadClient;
