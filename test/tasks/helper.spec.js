var expect = require('expect.js');
var testHelper = require('./helper');
var helper = require('../../lib/common/helper');

describe('read files', function () {
    it('should return mod times and file content', function (done) {
        helper.readFiles(testHelper.normalizePath([
            'resource/css/a.less',
            'watch-config.js'
        ])).on('done', function (err, data, mtimes) {
            expect(err).to.eql(null);
            expect(data.length).to.eql(2);
            expect(mtimes.length).to.eql(2);
            expect(mtimes[0] instanceof Date).to.be(true);
            done();
        });
    });

    it('should throw exception when read fail', function (done) {
        helper.readFiles(testHelper.normalizePath([
            'resource22/css/a.less',
            'watch-config.js'
        ])).on('done', function (err) {
            expect(err).not.to.eql(null);
            done();
        });
    });
});
