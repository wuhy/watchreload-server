var expect = require('expect.js');
var helper = require('./helper');
var protocolCommand = require('../../lib/protocol').Command;

describe('watch server event', function () {

    var watchServer = helper.createWatchServer({
        port: 12346,
        configFile: helper.getConfigFile('watch-config.js')
    });

    /**
     * 重写发送给客户端消息，用于test是否正确发送了消息
     *
     * @override
     */
    watchServer.sendCommandMessage = function (data) {
        this.emit('command', data);
    };

    var jsFile = 'test-edit.js';

    var hasStartEvent = false;
    watchServer.webServer.once('start', function () {
        hasStartEvent = true;
    });

    it('must fire start event when start', function () {
        expect(hasStartEvent).to.be(true);
    });

    it('JS file change must fire fileAll and send updateModule event', function (done) {
        var doneCount = 0;
        watchServer.fileWatcher.once('fileAll', function (event, filePath) {
            expect((new RegExp(jsFile + '$')).test(filePath)).to.be(true);
            expect(event).to.eql('fileChange');

            (++doneCount === 2) && done();
        });

        watchServer.once('command', function (info) {
            if ((new RegExp(jsFile + '$')).test(info.data.path)
                && info.type === protocolCommand.updateModule
                ) {

                if (++doneCount === 2) {
                    done();
                }
            }
        });

        helper.editJSResourceFile(jsFile);
    });

    it('CSS file change must send cssReload event to client', function (done) {
        var cssFile = 'test-edit.css';
        watchServer.once('command', function (info) {
            if ((new RegExp(cssFile + '$')).test(info.data.path)
                && info.type === protocolCommand.reloadCSS
                ) {
                done();
            }
        });

        helper.editCSSResourceFile(cssFile);
    });

    it('must reload when config file change', function (done) {
        var configFile = watchServer.configFile;

        watchServer.fileWatcher.once('configChange', function () {
            done();
        });

        var insertContent = '\n/* edit done */';
        console.log(configFile)
        helper.editFileAndSave(configFile, function (data) {
            var content = data.toString();
            if (content.indexOf(insertContent) !== -1) {
                return content.replace(insertContent, '');
            }
            return content + insertContent;
        });
    });

});
