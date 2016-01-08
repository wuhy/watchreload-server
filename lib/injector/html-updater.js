/**
 * @file html 文档内容更新器
 * @author sparklewhy@gmail.com
 */

var htmlParser = require('../common/html');

var LAST_CLOSE_BODY_REGEXP = htmlParser.getCloseElementRegexp('body');
var LAST_CLOSE_HEAD_REGEXP = htmlParser.getCloseElementRegexp('head');

function getScriptSnippet(options) {
    var snippet = options.snippet;
    if (!/^<script/.test(snippet.trim())) {
        return '<script src="' + snippet + '"></script>';
    }
    return snippet;
}

function getStyleSnippet(options) {
    var snippet = options.snippet;
    if (!/^<(style|link)/.test(snippet.trim())) {
        return '<link href="' + snippet + '" rel="stylesheet" />';
    }
    return snippet;
}

function updateStyleScript(content, options, isStyle) {
    var snippet = isStyle
        ? getStyleSnippet(options)
        : getScriptSnippet(options);
    if (content.indexOf(snippet) !== -1) {
        return content;
    }

    var replacer = options.replacer;
    if (replacer === 'append') {
        var regexp = isStyle ? LAST_CLOSE_HEAD_REGEXP : LAST_CLOSE_BODY_REGEXP;
        var closeTag = isStyle ? '</head>' : '</body>';
        return content.replace(regexp, snippet + closeTag);
    }

    var replaceDone = false;
    var handler = isStyle ? 'parseStyle' : 'parseScript';
    return htmlParser[handler](content, function (found) {
        var match = found.match;
        if (replaceDone) {
            return match;
        }

        if (replacer === 'prepend') {
            replaceDone = true;
            return snippet + match;
        }
        else if (typeof replacer === 'function') {
            return replacer(found, snippet, options);
        }

        return match;
    });
}

/**
 * 处理 html 文档的注入
 *
 * @param {string} content 要处理注入的 html 文档内容
 * @param {Object} options 注入选项
 * @param {string} options.snippet 要替换的或者插入的脚本|样式内容 或者 url
 * @param {string} options.type 要注入的资源类型: 'script' | 'style'
 * @param {string|function(string, Object):string=} options.replacer 替换位置 或
 *        自定义的替换处理器
 * @return {string}
 */
module.exports = exports = function (content, options) {
    var type = (options.type || '').toLowerCase();
    switch (type) {
        case 'style':
            return updateStyleScript(content, options, true);
        case 'script':
            return updateStyleScript(content, options, false);
    }

    if (!type) {
        throw new Error('unknow update type: ' + type);
    }

    return options.replacer(content, options);
};
