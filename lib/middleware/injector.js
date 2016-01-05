/**
 * @file 提供 watchreload 客户端脚本注入中间件
 * @author sparklewhy@gmail.com
 */

var helper = require('../common/helper');
var _ = require('lodash');

/**
 * 匹配最后一个 body 关闭元素正则表达式
 *
 * @type {RegExp}
 */
var LAST_CLOSE_BODY_REGEXP = /<\s*\/\s*body\s*>(?![\s\S]*<\s*\/\s*body\s*>)/i;

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

    var checkInject = function (res) {
        var contentType = res.getHeader('content-type');
        return contentType && (contentType.toLowerCase().indexOf('text/html') >= 0);
    };

    var inject = function (data, encoding) {
        var content = data.toString(encoding);
        var snippet = options.snippet;
        if (content.indexOf(snippet) === -1) {
            content = content.replace(LAST_CLOSE_BODY_REGEXP, snippet + '</body>');
            return new Buffer(content, encoding);
        }
        return data;
    };

    var fakeRes = {

        /**
         * @override
         */
        setHeader: function (name, value) {
            if (name === 'content-length' || name === 'Content-Length') {
                this.hasContentLength = true;
                return;
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
            if (checkInject(this)) {
                if (!this.injectCache) {
                    this.injectCache = [];
                    this.injectCacheSize = 0;
                }

                this.injectCacheSize += chunk.length;
                if (!Buffer.isBuffer(chunk)) {
                    chunk = new Buffer(chunk, encoding);
                }
                this.injectCache.push(chunk);
            }
            else {
                return rawWrite.apply(this, arguments);
            }
        },

        /**
         * @override
         */
        end: function (data, encoding) {
            if (checkInject(this)) {
                this.write(data, encoding);

                data = Buffer.concat(
                    this.injectCache, this.injectCacheSize
                );
                this.injectCache = this.injectCacheSize = null;

                var contentEncoding = res.getHeader('content-encoding');
                var result = helper.unzip(data, contentEncoding);
                data = result.data;

                // 对于无法处理的编码不做注入处理
                if (!result.encoding) {
                    data = inject(data, encoding);
                }

                data = helper.zip(data, contentEncoding).data;
                if (this.hasContentLength) {
                    rawSetHeader.call(this, 'content-length', data.length);
                }
                return rawEnd.call(this, data, encoding);
            }

            return rawEnd.apply(this, arguments);
        }
    };

    return _.assign(res, fakeRes);
}

module.exports = exports = function (options) {
    return function (req, res, next) {
        initResponse(req, res, options);
        next();
    };
};
