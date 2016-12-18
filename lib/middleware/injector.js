/**
 * @file 提供 watchreload 客户端脚本注入中间件
 * @author sparklewhy@gmail.com
 */

var helper = require('../common/helper');
var _ = require('lodash');

/**
 * 初始化响应对象
 *
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Object} options 选项
 * @return {Object}
 */
function initResponse(req, res, options) {
    var rawSetHeader = res.setHeader;
    var rawWriteHead = res.writeHead;
    var rawWrite = res.write;
    var rawEnd = res.end;

    var WritableStream = require('stream-buffers').WritableStreamBuffer;
    var tasks = options.tasks || [];
    var fakeRes = {

        /**
         * 注入处理
         *
         * @param {Buffer} data 原始数据
         * @param {string=} encoding 编码
         * @return {Buffer}
         */
        inject: function (data, encoding) {
            var content = data.toString(encoding);
            for (var i = 0, len = tasks.length; i < len; i++) {
                var item = tasks[i];
                if (this.checkTaskInject(item) && item.process) {
                    content = item.process(content, item.options);
                }
            }

            return new Buffer(content, encoding);
        },

        /**
         * 检查是否需要注入处理
         *
         * @param {Object} task 注入的任务
         * @return {boolean}
         */
        checkTaskInject: function (task) {
            if (this.enableInject && !task.when) {
                return true;
            }

            return task.when && task.when(req, res);
        },

        /**
         * 检查是否需要注入处理
         *
         * @return {boolean}
         */
        checkInject: function () {
            if (this.enableInject) {
                return true;
            }

            if (this.hasCheckInject) {
                return this.allowInject;
            }

            this.hasCheckInject = false;
            return (this.allowInject = tasks.some(function (item) {
                return item.when && item.when(req, res);
            }));
        },

        /**
         * @override
         */
        setHeader: function (name, value) {
            name = name.toLowerCase();
            if (name === 'content-length') {
                this.contentLenInfo = {
                    name: name,
                    value: value
                };
                return;
            }

            // 如果指定了通过 content-type 来判断是否要注入处理，如果不满足则恢复响应状态
            if (name === 'content-type' && options.whenContentType) {
                this.enableInject = options.whenContentType(value);
                if (!this.enableInject) {
                    var contentLenInfo = this.contentLenInfo;
                    if (contentLenInfo) {
                        rawSetHeader.call(this, contentLenInfo.name, contentLenInfo.value);
                    }

                    this.setHeader = rawSetHeader;
                    this.writeHead = rawWriteHead;
                    this.write = rawWrite;
                    this.end = rawEnd;
                }
            }

            return rawSetHeader.apply(this, arguments);
        },

        /**
         * @override
         */
        writeHead: function (status, statusMessage, headers) {
            var me = this;

            _.each(headers || statusMessage, function (value, name) {
                me.setHeader(name, value);
            });

            return rawWriteHead.call(
                this, status,
                typeof statusMessage === 'string' ? statusMessage : undefined
            );
        },

        /**
         * @override
         */
        write: function (chunk, encoding) {
            if (this.checkInject()) {
                if (!this.injectBuffer) {
                    this.injectBuffer = new WritableStream();
                }

                return this.injectBuffer.write(chunk, encoding);
            }

            return rawWrite.apply(this, arguments);
        },

        /**
         * @override
         */
        end: function (data, encoding) {
            if (!this.checkInject()) {
                return rawEnd.apply(this, arguments);
            }

            if (data) {
                this.write(data, encoding);
            }

            this.write = rawWrite;
            if (this._hasBody && this.injectBuffer) {
                data = this.injectBuffer.getContents();
                this.injectBuffer = null;

                var contentEncoding = res.getHeader('content-encoding');
                var result = helper.unzip(data, contentEncoding);
                data = result.data;

                // 对于无法处理的编码不做注入处理
                if (!result.encoding) {
                    data = this.inject(data, encoding);
                }

                data = helper.zip(data, contentEncoding).data;
            }

            return rawEnd.call(this, data, encoding);
        }
    };

    return _.assign(res, fakeRes);
}

/**
 * 注入中间件
 *
 * @param {Object} options 注入选项
 * @param {function(string):boolean=} options.whenContentType 判断内容类型是否允许注入处理
 * @param {Array.<{process: Function, when: Function, options: Object}>} options.tasks
 *        注入处理的任务定义
 * @return {Function}
 */
module.exports = exports = function (options) {
    return function (req, res, next) {
        initResponse(req, res, options);
        next();
    };
};
