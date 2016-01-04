/**
 * @file 用于和客户端进行通信的服务端
 * @author  sparklewhy@gmail.com
 */

var _ = require('lodash');
var chalk = require('chalk');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var helper = require('./common/helper');
var log = require('./common/log');
var FileMonitor = require('./file-monitor');
var WebServer = require('./web-server');
var watchHandler = require('./watch-handler');
var protocolCommand = require('./protocol').Command;

/**
 * 默认的自定义的监控配置文件
 *
 * @type {string}
 */
var WATCHER_CONFIG_FILE = 'watch-config.js';

/**
 * 文件监控默认配置信息
 *
 * @type {Object}
 */
var DEFAULT_OPTIONS = require('./watch-default-config');

/**
 * 创建监控Server实例
 *
 * @constructor
 * @extends {EventEmitter}
 *
 * @param {Object=} options 创建 server 的选项信息，更详细的选项信息，参见
 *                  `watch-default-config.js`
 * @param {number=} options.port 启动的 server 监听的端口
 * @param {Array.<string>=} options.files 要监控的文件
 * @param {string=} options.configFile 自定义的配置文件路径
 */
function WatchServer(options) {
    options || (options = {});
    var configFile = options.configFile;
    var basePath = options.basePath;

    // 初始化配置文件
    if (configFile) {
        configFile = helper.resolvePath(basePath, configFile);
    }
    else {
        configFile = helper.resolvePath(basePath, WATCHER_CONFIG_FILE);
        this.useDefaultConfig = true;
    }
    this.configFile = configFile;

    var config = _.merge(this.readWatchConf(configFile), options);
    this.init(config);
}

util.inherits(WatchServer, EventEmitter);

/**
 * 读取文件监控相关配置信息
 *
 * @param {string} configFile 配置文件路径
 * @return {Object}
 */
WatchServer.prototype.readWatchConf = function (configFile) {
    var watcherOptions = {};
    var customOption;

    try {
        // 删除缓存
        delete require.cache[require.resolve(configFile)];
        customOption = require(configFile);
    }
    catch (ex) {
        !this.useDefaultConfig
            && log.error('watchreload config file not found: %s', configFile);
        customOption = {};
    }

    // 初始化要监听的客户端消息类型: 合并用户定制和默认的消息类型
    var messageTypes = _.clone(DEFAULT_OPTIONS.client.messageTypes);
    var existedMsgTypeMap = {};
    messageTypes.forEach(function (type) {
        existedMsgTypeMap[type] = true;
    });
    var customMessageTypes = (customOption.client || {}).messageTypes || [];
    customMessageTypes.forEach(function (type) {
        if (!existedMsgTypeMap[type]) {
            messageTypes.push(type);
            existedMsgTypeMap[type] = true;
        }
    });

    // 合并默认和用户定制的消息类型，重置消息类型的配置信息
    _.merge(watcherOptions, DEFAULT_OPTIONS, customOption);
    watcherOptions.client.messageTypes = messageTypes;

    return watcherOptions;
};

/**
 * 初始化监控服务器选项信息
 *
 * @param {Object} options 初始化选项信息，说明见构造函数
 */
WatchServer.prototype.init = function (options) {
    this.workingDir = helper.resolvePath(options.basePath || '.');
    this.options = options;

    // 设置 log 层级
    log.setLogLevel(options.logLevel);
};

/**
 * 执行启动前要执行的 shell 脚本
 *
 * @param {string} shell 要执行的shell脚本
 */
WatchServer.prototype.executeShell = function (shell) {
    if (!shell || this._cp) {
        return;
    }

    var options = {
        cwd: this.workingDir
    };

    if (!this.options.capturePrestartOutput) {
        options.stdio = ['ignore', 'ignore', process.stderr];
    }

    var cp = helper.spawnShell(shell, options);
    cp.on('close', function (code) {
        if (code !== 0) {
            log.error(
                'Execute %s, error happen, exit errocode: %d',
                chalk.red(shell), code
            );
        }
    });
    this._cp = cp;
};

/**
 * 启动监控Server
 */
WatchServer.prototype.start = function () {
    var options = this.options;

    // 执行启动前要执行的脚本
    this.executeShell(options.prestart);

    // 启动HTTPServer和Socket通信
    var webServer = new WebServer(options);
    this.webServer = webServer;
    webServer.start();
    helper.bindListeners(webServer, watchHandler.csWatchHandler, this);
    helper.bindListeners(webServer, options.io, this);

    // 启动文件监控
    this.fileWatcher = new FileMonitor({
        configFile: this.useDefaultConfig ? null : this.configFile,
        basePath: options.basePath,
        files: options.files,
        fileTypes: options.fileTypes
    });
    this.fileWatcher.start();
    helper.bindListeners(this.fileWatcher, watchHandler.fileWatchHandler, this);
    helper.bindListeners(this.fileWatcher, options.watch, this);
};

/**
 * 关闭监控服务器
 */
WatchServer.prototype.close = function () {
    this.fileWatcher.close();
    this.webServer.close();
};

/**
 * 重新启动文件监控
 */
WatchServer.prototype.restartFileWatch = function () {
    this.fileWatcher.restart(this.files);
    helper.bindListeners(this.fileWatcher, watchHandler.fileWatchHandler);
    helper.bindListeners(this.fileWatcher, this.options.watch);
};

/**
 * 向连接的客户端发送命令消息
 *
 * @param {Object} data 要发送的消息数据
 * @param {Object=} client 要发送消息的socket客户端，可选，默认会向所有client发送
 */
WatchServer.prototype.sendCommandMessage = function (data, client) {
    this.webServer.sendCommandMessage(data, client);
};

/**
 * 发送客户端初始化命令消息
 *
 * @param {Object=} client 要发送的目标客户端，可选，默认全部客户端都发送
 */
WatchServer.prototype.sendInitCommandMessage = function (client) {
    var options = this.options;

    this.webServer.sendCommandMessage(
        {
            type: protocolCommand.init,
            logLevel: options.logLevel,
            livereload: options.livereload || {}
        },
        client
    );
};

module.exports = exports = WatchServer;
