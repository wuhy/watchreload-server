 /**
 * @file web server
 * @author sparklewhy@gmail.com
 */

var util = require('util');
var http = require('http');
var connect = require('connect');
var io = require('socket.io');
var EventEmitter = require('events').EventEmitter;

var helper = require('./common/helper');
var proxy = require('./middleware/proxy');
var staticServer = require('./middleware/static');
var watchreloadResponser = require('./middleware/client');
var htmlInjector = require('./middleware/injector');
var fileResponser = require('./middleware/reader');

var BUILTIN_EVENTS = ['start', 'error', 'connection'];

/**
 * 创建 web server 实例
 *
 * @param {Object} options 创建选项
 * @param {string=} options.basePath 启动的根路径
 * @param {number} options.port 监听的端口
 * @param {Object} options.client 客户端配置
 * @param {string=} options.path 要加载的 `livereload` 的客户端脚本路径，可以指定自己的
 *        客户端脚本，如果不想使用默认的话。文件路径基于 `basePath`，未设置 `bathPath`，
 *        基于当前工作目录。
 * @param {string=} options.name 要加载的 `livereload` 的客户端脚本名称
 * @param {Array.<string>=} options.client.messageTypes 要监听的客户端消息类型
 * @param {Array.<string>=} options.client.plugins 客户端附加加载的插件的路径列表，文件
 *        路径基于 `basePath`，未设置 `bathPath`，基于当前工作目录。
 * @param {string|boolean|Object=} options.proxy 服务器使用的代理：
 *        proxy: 'localhost:8080'
 *        or
 *        proxy: {
 *            host: 'localhost',
 *            port: '8080'
 *        }
 *        不想使用代理，设为false即可，这也是 watchreload 默认值。
 * @param {boolean=} options.debug 是否启用调试，可选，默认 false
 * @constructor
 * @extends {EventEmitter}
 */
function WebServer(options) {
    this.ip = options.ip || helper.getIPv4()[0];
    this.port = options.port;
    this.protocol = options.protocol || 'http';

    // 初始化要监听的客户端消息类型
    var msgTypes = options.client.messageTypes;
    var result = [];
    msgTypes.forEach(function (type) {
        if (BUILTIN_EVENTS.indexOf(type) === -1) {
            result.push(type);
        }
    });
    this.clientMsgTypes = result;

    var app = options.app;
    if (app) {
        this.initLiveReload(app, options);
    }
    else {
        app = connect();
        this.initLiveReload(app, options);
        this.initProxyServer(app, options);
    }
    this.app = app;
}

util.inherits(WebServer, EventEmitter);

 /**
  * 初始化 代理服务器 相关中间件
  *
  * @private
  * @param {Object} app server 实例
  * @param {Object} options 初始化选项
  */
WebServer.prototype.initProxyServer = function (app, options) {
    var basePath = options.basePath;

    // 初始化代理中间件
    var proxyInfo = options.proxy;
    var proxyMiddleware;
    if (proxyInfo && typeof proxyInfo === 'string') {
        proxyMiddleware = proxy({target: proxyInfo});
    }
    else if (proxyInfo && typeof proxyInfo === 'object') {
        proxyMiddleware = proxy({
            host: proxyInfo.host,
            port: proxyInfo.port
        });
    }

    if (proxyMiddleware) {
        app.use(proxyMiddleware);
    }

    // 如果未配置代理，web服务器作为静态服务器使用
    if (!proxyMiddleware) {
        var rootPath = helper.resolvePath('.', basePath);

        app.use(staticServer({
            root: rootPath
        }));
    }
};


/**
 * 初始化 live reload 相关中间件
 *
 * @private
 * @param {Object} app server 实例
 * @param {Object} options 初始化选项
 */
WebServer.prototype.initLiveReload = function (app, options) {
    var clientConf = options.client;
    var basePath = options.basePath;
    var ip = this.ip;
    var port = this.port;
    var host = this.protocol + '://' + ip + ':' + port + '/';

    // 初始化响应 watchreload 客户端脚本中间件
    app.use(watchreloadResponser({
        debug: options.debug,
        url: host,
        basePath: basePath,
        path: clientConf.path,
        name: clientConf.name,
        plugins: clientConf.plugins
    }));

    var tasks = [];
    var livereloadUrl = host + clientConf.name;

    // 初始化 hmr
    var hmrOpt = options.hmr;
    var hmrLoader;
    try {
        hmrLoader = hmrOpt && require('./hmr/' + (hmrOpt.loader || 'esl'));
    }
    catch (ex) {
    }

    if (hmrLoader) {
        var loaderPath = hmrLoader.getLoaderPath(hmrOpt.loaderPath);
        tasks.push({
            process: require('./injector/loader-replacer'),
            options: {
                isLoader: hmrOpt.isLoader || hmrLoader.isLoader,
                loaderUrl: host + loaderPath,
                updater: function (loaderScript) {
                    var livereloadScript
                        = '<script src="' + livereloadUrl + '"></script>';
                    return livereloadScript + loaderScript;
                }
            }
        });
        app.use(fileResponser({
            reqPath: loaderPath,
            resFiles: [hmrLoader.getLoaderFile(options.debug)]
        }));
    }
    else {
        // 初始化注入 watchreload 客户端脚本的中间件
        tasks.push({
            process: require('./injector/inject-script'),
            options: {
                url: livereloadUrl
            }
        });
    }

    app.use(htmlInjector({
        whenContentType: function (value) {
            return value.toLowerCase().indexOf('text/html') !== -1;
        },
        tasks: tasks
    }));
};

/**
 * 获取当前连接数量
 *
 * @return {number}
 */
WebServer.prototype.getConnectionCount = function () {
    var sockets = this.io.sockets.sockets || {};
    return Object.keys(sockets).length;
};

/**
 * 向连接的客户端发送命令消息
 *
 * @param {Object} data 要发送的消息数据
 * @param {Object=} client 要发送消息的socket客户端，可选，默认会向所有client发送
 */
WebServer.prototype.pushCommandMessage = function (data, client) {
    var cmdName = 'command';

    if (client) {
        client.emit(cmdName, data);
    }
    else {
        this.io.emit(cmdName, data);
    }
};

/**
 * 获取服务器访问的 url
 *
 * @return {string}
 */
WebServer.prototype.getVisitURL = function () {
    return this.protocol + '://' + this.ip + ':' + this.port;
};

/**
 * 启动服务器
 *
 * @param {http.Server=} httpServer 要挂载的 http server，可选
 */
WebServer.prototype.start = function (httpServer) {
    var me = this;

    if (me.started) {
        return;
    }

    me.started = true;

    me.httpServer = httpServer || http.createServer(me.app);
    me.io = io(me.httpServer);

    me.io.on('connection', function (socket) {
        /**
         * @event connection 连接进入事件
         */
        me.emit('connection', socket, me.getConnectionCount());

        helper.proxyEvents(socket, me, me.clientMsgTypes, true);
    });

    var port = me.port;
    if (!httpServer) {
        me.httpServer.listen(port);
    }

    me.httpServer.on(
        'listening',
        function () {
            /**
             * 启动服务器成功事件
             *
             * @event start
             */
            me.emit('start', me.ip, port);
        }
    ).on(
        'error',
        function (e) {
            /**
             * 启动服务器失败事件
             *
             * @event error
             */
            me.emit('error', e);
        }
    );
};

/**
 * 关闭服务器
 */
WebServer.prototype.close = function () {
    if (this.httpServer) {
        // close existed connection
        var clients = this.io.sockets.clients();
        for (var i = 0, len = clients.length; i < len; i++) {
            clients[i].disconnect();
        }

        this.httpServer.close();
    }
};

module.exports = exports = WebServer;
