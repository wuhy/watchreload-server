/**
 * @file 文件监控服务器监听事件类型的默认处理器
 * @author wuhuiyao
 */

var chalk = require('chalk');
var log = require('./common/log');
var protocolCommand = require('./protocol').Command;
var resDep = require('./resource-dependence');

/**
 * 各种文件类型发生修改，要触发的动作定义
 *
 * @type {Object}
 */
var fileTypeAction = {
    style: {
        remove: protocolCommand.reloadCSS,
        change: protocolCommand.reloadCSS,
        add: protocolCommand.reloadCSS
    },
    image: {
        remove: protocolCommand.reloadImage,
        change: protocolCommand.reloadImage,
        add: protocolCommand.reloadImage
    }
};

function getFileUpdateAction(type, fileInfo) {
    if (this.config.hmr) {
        fileTypeAction.script = {
            remove: protocolCommand.removeModule,
            change: protocolCommand.updateModule,
            add: protocolCommand.addModule
        };
    }
    else {
        fileTypeAction.script = null;
    }

    return (fileTypeAction[fileInfo.type] || {})[type]
        || protocolCommand.reloadPage;
}

function getReloadFile(changeFilePath, options) {
    var reloadPath = resDep.findResByLiveReload(
        changeFilePath, options.livereload || {}
    );
    if (!reloadPath) {
        reloadPath = resDep.findResByDep(changeFilePath);
    }

    if (reloadPath && !Array.isArray(reloadPath)) {
        reloadPath = [reloadPath];
    }
    return reloadPath;
}

function sendFileRemoveMsg(server, filePath, fileInfo) {
    server.sendCommandMessage({
        type: getFileUpdateAction.call(server, 'remove', fileInfo),
        path: filePath
    });
}

function sendFileAddMsg(server, filePath, fileInfo) {
    server.sendCommandMessage({
        type: getFileUpdateAction.call(server, 'add', fileInfo),
        path: filePath
    });
}

function sendFileChangeMsg(server, filePath, fileInfo) {
    server.sendCommandMessage({
        type: getFileUpdateAction.call(server, 'change', fileInfo),
        data: fileInfo
    });
}

function processFileChange(server, filePath, fileInfo, defaultProcessor) {
    var reloadFile = getReloadFile(filePath, server.config);
    if (reloadFile) {
        reloadFile.forEach(function (file) {
            var changeFileInfo = server.fileWatcher.getFileInfo(file);
            sendFileChangeMsg(server, file, changeFileInfo);
        });
    }
    else {
        defaultProcessor(server, filePath, fileInfo);
    }
}

/**
 * 文件变化相关的事件类型的处理器定义
 *
 * @type {Object}
 */
var fileChangeHandler = {
    fileDelete: function (server, filePath, fileInfo) {
        processFileChange(server, filePath, fileInfo, sendFileRemoveMsg);
    },
    fileChange: function (server, filePath, fileInfo) {
        processFileChange(server, filePath, fileInfo, sendFileChangeMsg);
    },
    fileAdd: function (server, filePath, fileInfo) {
        processFileChange(server, filePath, fileInfo, sendFileAddMsg);
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
    },

    /**
     * 同步模块信息
     *
     * @param {Object} socket 连接的socket
     * @param {Object} data 要同步的模块文件 信息
     */
    syncModule: function (socket, data) {
        log.info('Sync module files...');
        this.sendSyncModuleMessage(socket, data);
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
     * @param {string} fileInfo 变化的文件信息
     */
    fileAll: function (event, filePath, fileInfo) {
        log.info('Watch file ' + chalk.yellow.bold(event) + ': ' + chalk.cyan(filePath));

        var handler = fileChangeHandler[event];
        handler && handler(this, filePath, fileInfo);
    }
};
