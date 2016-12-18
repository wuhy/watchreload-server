/**
 * @file 模块加载器替换
 * @author sparklewhy@gmail.com
 */

var htmlUpdater = require('./html-updater');

/**
 * 注入脚本 url
 *
 * @param {string} content 要注入的 html 文档内容
 * @param {Object} options 注入选项
 * @param {function(string):boolean} options.isLoader 判断当前的脚本 url 是否是要替换的脚本 url
 * @param {string} options.loaderUrl 要替换的 loader url
 * @param {function(string):string=} options.updater 自定义的加载器脚本更新方法
 * @return {string}
 */
module.exports = exports = function (content, options) {

    return htmlUpdater(content, {
        type: 'script',
        snippet: options.loaderUrl,
        replacer: function (found) {
            var match = found.match;
            var src = found.src;
            if (found.isScriptLink && options.isLoader(src)) {
                options.loaderUrl
                && (match = match.replace(src, options.loaderUrl));

                if (typeof options.updater === 'function') {
                    match = options.updater(match);
                }
            }
            return match;
        }
    });
};
