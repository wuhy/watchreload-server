/**
 * @file html 工具方法
 * @author sparklewhy@gmail.com
 */

var SCRIPT_ELEM_REGEXP
    = /<!--([\s\S]*?)(?:-->|$)|(\s*<script([^>]*)>([\s\S]*?)<\/script>)\n?/ig;
var LINK_STYLE_ELEM_REGEXP
    = /<!--([\s\S]*?)(?:-->|$)|(?:\s*(<link([^>]*?)(?:\/)?>)|(<style([^>]*)>([\s\S]*?)<\/style>))\n?/ig;

var TYPE_ATTR_REGEXP = /type=('|")(.*?)\1/i;
var HREF_ATTR_REGEXP = /\s*(?:href)=('|")(.+?)\1/i;
var SRC_ATTR_REGEXP = /\s*(?:src)=('|")(.+?)\1/i;
var REL_ATTR_REGEXP = /rel=('|")stylesheet\1/i;

var SCRIPT_TYPES = ['text/javascript', 'application/javascript'];

module.exports = exports = {};

/**
 * 解析 html 的脚本
 *
 * @param {string} content 要解析的 html 内容
 * @param {function(Object):string} replacer 碰到解析到的脚本元素要执行的替换逻辑
 * @return {string}
 */
exports.parseScript = function (content, replacer) {
    return content.replace(SCRIPT_ELEM_REGEXP,
        function (all, comment, script, attrs, body) {
            if (comment) {
                return all;
            }

            body = body.trim();
            if (!body && SRC_ATTR_REGEXP.test(attrs)) {
                var src = RegExp.$2;
                attrs = attrs.replace(SRC_ATTR_REGEXP, '').replace(/\s+$/, '');
                return replacer({
                    match: all,
                    isScriptLink: true,
                    src: src,
                    attrs: attrs
                });
            }
            else if (!TYPE_ATTR_REGEXP.test(attrs)
                || (SCRIPT_TYPES.indexOf(RegExp.$2.toLowerCase()) !== -1)
            ) {
                return replacer({
                    match: all,
                    isInlineScript: true,
                    inlineContent: body,
                    attrs: attrs
                });
            }

            return replacer({
                match: all,
                inlineContent: body,
                attrs: attrs
            });
        }
    );
};

/**
 * 解析 html 的样式
 *
 * @param {string} content 要解析的 html 内容
 * @param {function(Object):string} replacer 碰到解析到的样式元素要执行的替换逻辑
 * @return {string}
 */
exports.parseStyle = function (content, replacer) {
    return content.replace(LINK_STYLE_ELEM_REGEXP,
        function (all, comment, link, linkAttr, style, styleAttr, body) {
            if (comment) {
                return all;
            }

            var isStyleLink = link && REL_ATTR_REGEXP.test(linkAttr)
                && HREF_ATTR_REGEXP.test(linkAttr);
            if (isStyleLink) {
                var href = RegExp.$2;
                linkAttr = linkAttr
                    .replace(HREF_ATTR_REGEXP, '')
                    .replace(/\s+$/, '');
                return replacer({
                    match: all,
                    isStyleLink: true,
                    href: href,
                    attrs: linkAttr
                });
            }
            else if (style) {
                return replacer({
                    match: all,
                    isInlineStyle: true,
                    inlineContent: body.trim(),
                    attrs: styleAttr
                });
            }

            return replacer({
                match: all,
                link: link
            });
        }
    );
};

/**
 * 获取闭合元素匹配的正则
 *
 * @param {string} tag 元素 tag 名称
 * @return {RegExp}
 */
exports.getCloseElementRegexp = function (tag) {
    var closeElem = '<\\s*\/\\s*' + tag + '\\s*>';
    var regexpStr = closeElem + '(?![\\s\\S]*' + closeElem + ')';
    return new RegExp(regexpStr, 'i');
};
