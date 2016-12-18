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
    this.options = options || {};
    this.initConfig();
}

util.inherits(WatchServer, EventEmitter);

/**
 * 读取文件监控相关配置信息
 *
 * @param {Object} options 读取选项
 * @param {string=} options.basePath 配置文件相对路径
 * @param {string=} options.configFile 配置文件名
 * @return {Object}
 */
WatchServer.prototype.readWatchConf = function (options) {
    var watcherOptions = {};
    var customOption;

    // 初始化配置文件
    var basePath = options.basePath;
    var configFile = helper.resolvePath(
        options.configFile || WATCHER_CONFIG_FILE,
        basePath || '.'
    );

    try {
        // 删除缓存
        delete require.cache[require.resolve(configFile)];
        customOption = require(configFile);
        this.configFile = configFile;
    }
    catch (ex) {
        options.configFile && log.error('watchreload config file not found: %s', configFile);
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
 * 初始化监控服务器配置信息
 */
WatchServer.prototype.initConfig = function () {
    var options = this.options;
    var config = _.merge(this.readWatchConf(options), options);
    this.workingDir = helper.resolvePath(options.basePath || '.');
    this.config = config;

    // 设置 log 层级
    log.setLogLevel(config.logLevel);
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

    if (!this.config.capturePrestartOutput) {
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
    var config = this.config;

    // 执行启动前要执行的脚本
    this.executeShell(config.prestart);

    // 启动文件监控
    this.fileWatcher = new FileMonitor({
        configFile: this.configFile,
        basePath: config.basePath,
        files: config.files,
        fileTypes: config.fileTypes
    });
    this.fileWatcher.start();

    // 绑定默认的文件监听处理器
    helper.bindListeners(this.fileWatcher, watchHandler.fileWatchHandler, this);

    // 绑定用户自定义的监听处理器
    helper.bindListeners(this.fileWatcher, config.watch, this);

    // 启动HTTPServer和Socket通信
    var webServer = new WebServer(config);
    this.webServer = webServer;
    helper.proxyEvents(webServer, this, ['start', 'error']);
    webServer.start();

    // 绑定默认的 socket 通信处理器
    helper.bindListeners(webServer, watchHandler.csWatchHandler, this);

    // 绑定用户自定义的 socket 通信处理器
    helper.bindListeners(webServer, config.io, this);
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

    helper.bindListeners(this.fileWatcher, watchHandler.fileWatchHandler, this);
    helper.bindListeners(this.fileWatcher, this.config.watch, this);
};

/**
 * 向连接的客户端发送命令消息
 *
 * @param {Object} data 要发送的消息数据
 * @param {Object=} client 要发送消息的socket客户端，可选，默认会向所有client发送
 */
WatchServer.prototype.sendCommandMessage = function (data, client) {
    this.webServer.pushCommandMessage(data, client);
};

/**
 * 发送客户端初始化命令消息
 *
 * @param {Object=} client 要发送的目标客户端，可选，默认全部客户端都发送
 */
WatchServer.prototype.sendInitCommandMessage = function (client) {
    var config = this.config;

    this.webServer.pushCommandMessage(
        {
            type: protocolCommand.init,
            data: {
                logLevel: config.logLevel,
                hmr: !!config.hmr
            }
        },
        client
    );
};

/**
 * 发送同步模块的信息
 *
 * @param {Object} client 要发送的目标客户端
 * @param {{modules: Array.<string>, resources: Array.<string>}} data 要同步的模块文件
 */
WatchServer.prototype.sendSyncModuleMessage = function (client, data) {
    var moduleInfos = [];
    data.modules.forEach(function (f, index) {
        moduleInfos[index] = this.getFileInfo(f);
    }, this.fileWatcher);

    var resourceInfos = [];
    data.resources.forEach(function (f, index) {
        resourceInfos[index] = this.getFileInfo(f);
    }, this.fileWatcher);
    this.webServer.pushCommandMessage({
        type: protocolCommand.syncModule,
        data: {
            modules: moduleInfos,
            resources: resourceInfos
        }
    }, client);
};

module.exports = exports = WatchServer;
