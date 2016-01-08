/**
 * @file 文件监控服务器监听事件类型的默认处理器
 * @author wuhuiyao
 */

var chalk = require('chalk');
var log = require('./common/log');
var protocolCommand = require('./protocol').Command;

/**
 * 各种文件类型发生修改，要触发的动作定义
 *
 * @type {Object}
 */
var fileTypeAction = {
    style: protocolCommand.reloadCSS,
    image: protocolCommand.reloadImage
};

/**
 * 文件变化相关的事件类型的处理器定义
 *
 * @type {Object}
 */
var fileChangeHandler = {
    fileDelete: function (server, filePath) {
        server.sendCommandMessage({
            type: protocolCommand.reloadPage,
            path: filePath
        });
    },
    fileChange: function (server, filePath, typeInfo) {
        var cmd = fileTypeAction[typeInfo.type] || protocolCommand.reloadPage;
        server.sendCommandMessage({
            type: cmd,
            path: filePath,
            fileInfo: typeInfo
        });
    },
    fileAdd: function (server, filePath) {
        server.sendCommandMessage({
            type: protocolCommand.reloadPage,
            path: filePath
        });
    }
};

module.exports = exports = {};

/**
 * 服务器端和客户端通信监控处理器定义
 *
 * @type {Object}
 */
exports.csWatchHandler = {

    /**
     * 客户端连接成功处理器
     *
     * @param {Object} socket 连接成功的socket
     * @param {number} count 连接的客户端数量
     */
    connection: function (socket, count) {
        log.info('Client connected: %s, connection count: %d', socket.id, count);

        // 发送初始化命令
        this.sendInitCommandMessage(socket);
    },

    /**
     * 客户端连接断开处理器
     *
     * @param {Object} socket 断开的socket
     */
    disconnect: function (socket) {
        log.info('Client %s disconnected...', socket.id);
    },

    /**
     * 注册客户端信息
     *
     * @param {Object} socket 连接的socket
     * @param {{ name: string }} data 客户端注册信息，其中name为客户端的useragent信息
     */
    register: function (socket, data) {
        log.info('Client info: ' + JSON.stringify(data));
    }
};


/**
 * 文件监控处理器定义
 *
 * @type {Object}
 */
exports.fileWatchHandler = {

    /**
     * 文件监控就绪处理器
     *
     * @param {Object} watchedFiles 监控的文件信息
     */
    watchReady: function () {
        log.info('Watching files start...');
    },

    /**
     * 文件监控出错处理器
     *
     * @param {Object} err 错误对象
     */
    watchError: function (err) {
        log.error('Watch file error: ' + err);
    },

    /**
     * 文件监控服务器配置文件变化处理器
     */
    configChange: function () {
        log.info(chalk.green('Reload watcher config...'));

        this.initConfig();
        this.restartFileWatch();

        // 发送初始化命令
        this.sendInitCommandMessage();
    },

    /**
     * 文件相关变化事件处理器
     *
     * @param {string} event 文件变化的事件类型：deleted/added/changed
     * @param {string} filePath 变化的文件路径
     * @param {string} fileTypeInfo 变化的文件类型信息
     */
    fileAll: function (event, filePath, fileTypeInfo) {
        log.info('Watch file ' + chalk.yellow.bold(event) + ': ' + chalk.cyan(filePath));

        var handler = fileChangeHandler[event];
        handler && handler(this, filePath, fileTypeInfo);
    }
};
