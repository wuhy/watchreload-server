/**
 * @file 注入客户端 reload 脚本
 * @author sparklewhy@gmail.com
 */

var htmlUpdater = require('./html-updater');

/**
 * 注入脚本 url
 *
 * @param {string} content 要注入的 html 文档内容
 * @param {Object} options 注入选项
 * @param {string} options.url 要注入的 reload url
 * @return {string}
 */
module.exports = exports = function (content, options) {
    return htmlUpdater(content, {
        type: 'script',
        snippet: options.url,
        replacer: 'append'
    });
};
