/**
 * @file 文件监控
 * @author sparklewhy@gmail.com
 */

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var chokidar = require('chokidar');
var _ = require('lodash');
var helper = require('./common/helper');
var log = require('./common/log');

/**
 * 创建文件监控实例
 *
 * @param {Object} options 文件监控选项信息
 * @param {string=} options.basePath 要监控的文件的基础路径，可选，默认当前执行目录
 * @param {Array.<string>} options.files 要监控的文件
 * @param {string=} options.configFile 监控配置文件，可选
 * @param {Object} options.fileTypes 文件类型定义
 * @constructor
 * @extends {EventEmitter}
 */
function FileMonitor(options) {
    options || (options = {});
    this.configFile = options.configFile;
    this.fileTypeMap = options.fileTypes || {};
    this.base = options.basePath || '.';

    this.initWatchFiles(options.files);
    this.initFileWatchEvents();
}

util.inherits(FileMonitor, EventEmitter);

/**
 * 初始化要监控的文件
 *
 * @param {Array.<string>} files 要监控的文件
 * @private
 */
FileMonitor.prototype.initWatchFiles = function (files) {
    files || (files = []);

    var ignoreFiles = [];
    var watchFiles = [];
    files.forEach(function (filePath) {
        var ignore = false;
        if (/^!/.test(filePath)) {
            ignore = true;
            filePath = filePath.substr(1);
        }

        if (ignore) {
            ignoreFiles.push(filePath);
        }
        else {
            watchFiles.push(filePath);
        }
    });

    if (this.configFile) {
        watchFiles.push(this.configFile);
    }

    this.ignoreFiles = ignoreFiles;
    this.watchFiles = watchFiles;
};

/**
 * 获取文件信息
 * {
 *   type: 'js',
 *   extName: 'js',
 *   isJs: true,
 *   path: 'a/b',
 *   fullPath: '/c/d/a/b',
 *   hash: 'xx',
 *   removed: true
 * }
 *
 * @param {string} file 文件路径
 * @return {Object}
 */
FileMonitor.prototype.getFileInfo = function (file) {
    var fileInfo = helper.getFileTypeInfo(file, this.fileTypeMap);
    var type = fileInfo.type;
    if (type && type.length) {
        type = type.toLowerCase();
        type = type.replace(/^(\w)/, function (match, firstLetter) {
            return firstLetter.toUpperCase();
        });
        fileInfo['is' + type] = true;
    }

    fileInfo.path = file;
    var fullPath = fileInfo.fullPath = helper.resolvePath(file, this.base);
    try {
        var fs = require('fs');
        var stateInfo = fs.statSync(fullPath);
        if (stateInfo.isFile()) {
            var content = fs.readFileSync(fullPath);
            fileInfo.hash = helper.md5sum(content);
        }
        else if (stateInfo.isDirectory()) {
            fileInfo.isDir = true;
        }
    }
    catch (ex) {
        fileInfo.removed = true;
        log.error(ex);
    }
    return fileInfo;
};

/**
 * 初始化文件监控事件
 *
 * @private
 */
FileMonitor.prototype.initFileWatchEvents = function () {
    var me = this;
    var eventMap = {
        ready: 'watchReady',
        change: 'fileChange',
        add: 'fileAdd',
        addDir: 'DirAdd',
        unlink: 'fileDelete',
        unlinkDir: 'DirDelete',
        all: 'fileAll'
    };
    this.fileWatchEvents = _.values(eventMap);

    /* eslint-disable fecs-dot-notation */
    this.fileWatchEventHandler = {

        /**
         * 文件监控就绪事件
         *
         * @event ready
         * @param {Array.<string>} watchFiles 被监控的文件
         */
        ready: eventMap.ready,

        /**
         * 文件发生变化事件
         *
         * @event fileChange
         * @param {string} filePath 发生变化的文件路径
         */
        change: eventMap.change,

        /**
         * 文件发生添加事件
         *
         * @event fileAdd
         * @param {string} filePath 添加的文件路径
         */
        add: eventMap.add,
        addDir: eventMap.addDir,

        /**
         * 文件发生删除事件
         *
         * @event fileDelete
         * @param {string} filePath 删除的文件路径
         */
        unlink: eventMap.unlink,
        unlinkDir: eventMap.unlinkDir,

        all: function (event, filePath) {
            var absPath = helper.resolvePath(filePath, me.base);
            if (me.configFile === absPath) {
                /**
                 * 监控配置文件发生变化触发的事件
                 *
                 * @event watchConfigChange
                 * @param {string} filePath 发生变更的文件路径
                 */
                me.emit('configChange', filePath);
            }
            else {

                /**
                 * 文件增删改所触发的事件
                 *
                 * @event fileAll
                 * @param {string} event 发生变更的事件
                 * @param {string} filePath 发生变更的文件路径
                 * @param {Object} fileInfo 发生变化的文件信息
                 */
                eventMap[event] && me.emit(
                    eventMap.all,
                    eventMap[event], filePath,
                    me.getFileInfo(filePath)
                );
            }
        },

        /**
         * 监控文件变化出错事件
         *
         * @event fileWatchError
         * @param {Object} err 出错的信息
         */
        error: 'watchError'
    };
    /* eslint-enable fecs-dot-notation */
};

/**
 * 绑定事件监听器
 *
 * @private
 */
FileMonitor.prototype.bindListeners = function () {
    helper.proxyEvents(this.watcher, this, this.fileWatchEventHandler);
};

/**
 * 添加要监控的文件
 *
 * @param {string|Array.<string>} file 要监控的文件
 */
FileMonitor.prototype.add = function (file) {
    if (this.watcher) {
        this.watcher.watch(file);
    }
    else {
        this.watchFiles = this.watchFiles.concat(file);
    }
};

/**
 * 移除给定的文件的监控
 *
 * @param {string|Array.<string>} file 要取消监控的文件
 */
FileMonitor.prototype.remove = function (file) {
    if (this.watcher) {
        this.watcher.unwatch(file);
    }
    else {
        if (!Array.isArray(file)) {
            file = [file];
        }

        var watchFiles = this.watchFiles;
        for (var i = watchFiles.length - 1; i >= 0; i--) {
            var found = file.indexOf(watchFiles[i]);
            if (found !== -1) {
                watchFiles.splice(i, 1);
                file.splice(found, 1);
            }
        }
        this.ignoreFiles = this.ignoreFiles.concat(file);
    }
};

/**
 * 启动文件的监控
 */
FileMonitor.prototype.start = function () {
    if (this.watcher) {
        return;
    }

    this.watcher = chokidar.watch(this.watchFiles, {
        ignored: this.ignoreFiles,
        ignoreInitial: true,
        cwd: this.base
    });
    this.bindListeners();
};

/**
 * 重启文件监控器
 *
 * @param {Array.<string>=} files 要监控的文件 可选
 */
FileMonitor.prototype.restart = function (files) {
    this.close();

    this.emit('restart');

    files && this.initWatchFiles(files);
    this.start();
};

/**
 * 关闭文件监控
 */
FileMonitor.prototype.close = function () {
    if (this.watcher) {
        this.fileWatchEvents.forEach(function (event) {
            this.removeAllListeners(event);
        }, this);
        this.watcher.close();
    }
    this.watcher = null;
};

module.exports = exports = FileMonitor;


