/**
 * @file 助手工具方法定义
 * @author  sparklewhy@gmail.com
 */

var spawn = require('child_process').spawn;
var os = require('os');
var _ = require('lodash');

module.exports = exports = {};

/**
 * 对于不满足位数的数用0填充
 *
 * @param  {number} value  要填充的数
 * @param  {number} bitNum 要显示的位数
 * @param  {string=} padValue 要填充的值，可选，默认0
 * @return {string}
 */
exports.padNumber = function (value, bitNum, padValue) {
    value = String(value);

    var padItems = [];
    padValue || (padValue = 0);
    for (var i = 0, len = bitNum - value.length; i < len; i++) {
        padItems[padItems.length] = padValue;
    }

    return padItems.join('') + value;
};

/**
 * 获取本机非内部的IPv4地址，如果获取不到，返回默认的本机IP地址：127.0.0.1
 *
 * @return {Array.<string>}
 */
exports.getIPv4 = function () {
    var networkInterfaces = os.networkInterfaces();
    var foundIPv4s = [];

    var checkIP = function (addressInfo) {
        if (addressInfo.internal === false && addressInfo.family === 'IPv4') {
            foundIPv4s.push(addressInfo.address);
        }

    };

    for (var network in networkInterfaces) {
        if (networkInterfaces.hasOwnProperty(network)) {
            var networkInfo = networkInterfaces[network];
            networkInfo.forEach(checkIP);
        }

    }

    if (!foundIPv4s.length) {
        foundIPv4s.push('127.0.0.1');
    }

    return foundIPv4s;

};

/**
 * spawn一个子进程，默认在当前工作目录执行，继承父进程的输入输出。
 *
 * 由于 spawn 只能执行 windows exe 的命令，对于批处理文件无法执行，虽然使用exec可以执行，但
 * 由于exec是阻塞式执行，子进程的输出无法被父进程捕获输出。
 *
 * Refer: https://github.com/joyent/node/issues/2318
 *
 * 这里解决办法：通过使用windows下的cmd来执行
 *
 * @param {string} command 要执行的命令
 * @param {Array.<string>} args 执行的命令的参数列表
 * @param {Object} options spawn的选项，参见node api 官网说明
 * @return {ChildProcess }
 */
exports.spawn = function (command, args, options) {
    var winCmd = process.env.comspec;

    return spawn(winCmd || command, winCmd ? [
        '/c'
    ].concat(command, args) : args, _.merge({
        stdio: 'inherit',
        cwd: process.cwd()
    }, options || {}));
};

/**
 * spawn一个子进程，执行给定的shell
 *
 * @param {string} shell 要执行的shell脚本
 * @param {Object} options spawn的选项，参见node api 官网说明
 * @return {ChildProcess}
 */
exports.spawnShell = function (shell, options) {
    var args = shell.split(' ');
    args = args.filter(function (item) {
        return item;
    });

    var cmd = args.shift();
    return exports.spawn(cmd, args, options);
};

exports.resolve = function (moduleName, optPaths) {
    var path = require('path');
    var local = path.join(process.cwd(), 'node_modules');
    var paths = [local];
    // var libPath = path.dirname(__dirname);
    // if (local !== libPath) {
    //     paths.push(libPath);
    // }

    if (optPaths) {
        optPaths.forEach(function (item) {
            var curr = path.resolve(item);
            if (paths.indexOf(curr) === -1) {
                paths.push(curr);
            }
        });
    }

    var resolve = require('resolve');
    var modulePath = null;
    paths.some(function (dir) {
        try {
            modulePath = resolve.sync(moduleName, {basedir: dir});
        }
        catch (e) {}

        if (modulePath) {
            return true;
        }
        return false;
    });

    return modulePath;
};

/**
 * 加载模块
 *
 * @param {string} moduleName 要加载的模块名
 * @param {Array.<string>=} optPaths 可选的模块查找路径
 * @return {*}
 */
exports.require = function (moduleName, optPaths) {
    var modulePath = exports.resolve(moduleName, optPaths);
    try {
        return modulePath ? require(modulePath) : require(moduleName);
    }
    catch (ex) {
        return null;
    }
};

_.extend(exports, require('./event'), require('./file'));
