/**
 * @file esl hmr 模块
 * @author sparklewhy@gmail.com
 */

var path = require('path');
var helper = require('../common/helper');

/**
 * 判断给定的源 url 是否是 esl 加载器
 *
 * @param {string} src 脚本 url
 * @return {boolean}
 */
exports.isLoader = function (src) {
    return src.indexOf('esl.js') !== -1;
};

exports.getLoaderPath = function (options) {
    return options.loaderPath || 'esl-hmr.js';
};

exports.getLoaderFile = function (options, debug) {
    var loaderPath = helper.resolve('watchreload.js/dist/esl.hmr', [
        path.join(__dirname, '../../node_modules')
    ]).replace(/\.js$/, '');
    var suffix = debug ? '.min.js' : '.js';
    return loaderPath + suffix;
};
