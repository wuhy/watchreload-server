define(function (require, exports, module) {
    var a = require('./a');
    return {
        hello: function () {
            a.hello();
        }
    }
});
