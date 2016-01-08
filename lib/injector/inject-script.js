/**
 * @file 注入客户端 reload 脚本
 * @author sparklewhy@gmail.com
 */

/**
 * 匹配最后一个 body 关闭元素正则表达式
 *
 * @type {RegExp}
 */
var LAST_CLOSE_BODY_REGEXP = /<\s*\/\s*body\s*>(?![\s\S]*<\s*\/\s*body\s*>)/i;

/**
 * 注入脚本 url
 *
 * @param {string} content 要注入的 html 文档内容
 * @param {Object} options 注入选项
 * @param {string} options.url 要注入的 reload url
 * @return {string}
 */
module.exports = exports = function (content, options) {
    var snippet = '<script src="' + options.url + '"></script>';
    if (content.indexOf(snippet) === -1) {
        content = content.replace(LAST_CLOSE_BODY_REGEXP, snippet + '</body>');
        return content;
    }
    return content;
};
