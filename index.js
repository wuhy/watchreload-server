/**
 * @file 入口模块
 * @author sparklewhy@gmail.com
 */

var log = require('./lib/common/log');
var _ = require('lodash');
var WatchServer = require('./lib/watch-server');

/**
 * 打开浏览器访问给定的URL
 *
 * @param {Object} options 打开的选项信息
 * @param {boolean=} options.autoOpen 是否自动打开，如果为false，则不执行打开URL操作
 * @param {string|Array.<string>|Object=} options.openBrowser 要自动打开的浏览器，
 *        也可以提供对象方式，key 是要打开的浏览器名称，value 是打开的选项，
 *        浏览器名称是平台独立的，未给定打开默认浏览器
 * @param {string=} options.openPath 要打开的url的访问的起始路径
 * @param {string} baseURL 要打开的URL的 base URL
 * @return {boolean} 如果执行了打开操作，返回true
 */
exports.tryOpenURL = function (options, baseURL) {
    options || (options = {});

    if (!options.autoOpen) {
        return false;
    }

    var openBrowsers = options.openBrowser;
    var url = require('url');
    var openURL = url.resolve(baseURL, options.openPath || '');
    var opn = require('opn');
    if (openBrowsers) {
        if (_.isPlainObject(openBrowsers)) {
            var result = [];
            Object.keys(openBrowsers).forEach(function (type, index) {
                result[index] = [type, openBrowsers[type]];
            });
        }
        else if (!Array.isArray(openBrowsers)) {
            openBrowsers = [
                openBrowsers
            ];
        }

        openBrowsers.forEach(function (browser) {
            opn(openURL, {app: browser});
        });
    }
    else {
        opn(openURL);
    }

    return true;
};

/**
 * watchreload 启动入口
 *
 * @param {Object=} options 启动选项信息，具体参见{@link watch-server}构造函数说明
 * @return {WatchServer}
 */
exports.start = function (options) {
    // 创建文件监控server实例
    var server = new WatchServer(options);
    server.on('start', function () {
        var webServer = this.webServer;
        log.info('Working Dir: ' + this.workingDir);
        log.info('Watch server start on port %d', webServer.port);

        var visitURL = webServer.getVisitURL();
        log.info('Web server started, visit %s', visitURL);

        exports.tryOpenURL(this.config, visitURL);
    }).on('error', function (err) {
        log.error('Start server failed: %s', err);
    });
    server.start();

    return server;
};

exports.Server = WatchServer;
