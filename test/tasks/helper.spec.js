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


describe('zip/uzip file', function () {
    it('should zip file', function () {
        var fs = require('fs');
        var data = fs.readFileSync(testHelper.normalizePath('watch-config.js'));
        var result = helper.zip(data, 'gzip');
        expect(result.encoding).to.eql('gzip');
        expect(result.data.length < data.length).to.be(true);

        result = helper.zip(data, 'deflate');
        expect(result.encoding).to.eql('deflate');
        expect(result.data.length < data.length).to.be(true);

        result = helper.zip(data, 'deflate gzip');
        expect(result.encoding).to.eql('gzip');
        expect(result.data.length < data.length).to.be(true);

        result = helper.zip(data, 'unknown');
        expect(result.encoding).to.eql(null);
        expect(result.data.length === data.length).to.be(true);
    });

    it('should unzip file', function () {
        var fs = require('fs');
        var data = fs.readFileSync(testHelper.normalizePath('watch-config.js'));
        var compressData = helper.zip(data, 'gzip').data;
        var unzipResult = helper.unzip(compressData, 'gzip');
        expect(unzipResult.encoding == null).to.eql(true);
        expect(unzipResult.data.toString()).to.eql(data.toString());

        compressData = helper.zip(data, 'deflate').data;
        unzipResult = helper.unzip(compressData, 'deflate');
        expect(unzipResult.encoding == null).to.eql(true);
        expect(unzipResult.data.toString()).to.eql(data.toString());

        unzipResult = helper.unzip(compressData, 'unknown');
        expect(unzipResult.encoding).to.eql('unknown');
        expect(unzipResult.data === compressData).to.be(true);
    });
});
