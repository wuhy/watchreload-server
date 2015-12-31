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
    watchServer.once('start', function () {
        hasStartEvent = true;
    });

    it('must fire start event when start', function () {
        setTimeout(function () {
            expect(hasStartEvent).to.be(true);
        }, 1);
    });

    it('JS file change must fire fileAll and send reloadPage event', function (done) {
        var doneCount = 0;
        watchServer.once('fileAll', function (event, filePath) {
            expect((new RegExp(jsFile + '$')).test(filePath)).to.be(true);
            expect(event).to.eql('changed');

            (++doneCount === 2) && done();
        });

        watchServer.once('command', function (data) {
            if ((new RegExp(jsFile + '$')).test(data.path)
                && data.type === protocolCommand.reloadPage
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
        watchServer.once('command', function (data) {
            console.log('edit css: ' + data);
            if ((new RegExp(cssFile + '$')).test(data.path)
                && data.type === protocolCommand.reloadCSS
                ) {
                done();
            }
        });

        helper.editCSSResourceFile(cssFile);
    });

    it('must reload when config file change', function (done) {
        var configFile = watchServer.configFile;
        var backFile = helper.backupFile(configFile);

        watchServer.once('watchConfigChange', function () {
            helper.recoverFile(backFile, configFile, true);
            done();
        });

        helper.editFileAndSave(configFile, function (data) {
            return helper.removeComments(data.toString());
        });
    });

});
