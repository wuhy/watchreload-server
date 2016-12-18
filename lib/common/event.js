/**
 * @file 事件相关工具方法
 * @author sparkelwhy@gmail.com
 */

/**
 * 处理事件代理
 *
 * @param  {EventEmitter} source 被代理的源对象
 * @param  {EventEmitter} target 要转发给的目标对象
 * @param  {string} eventName 要代理的事件名称
 * @param  {Object=} options 附件的选项
 * @param  {string|Function=} options.newEventName 代理后发射的新的事件名称
 *                            或自定义处理方法，若为空，默认跟原始名称一样
 * @param {boolean=} options.prependSourceArg 是否要追加事件源的 `source` 参数到
 *                            `target` 的事件回调参数里，可选，默认false
 * @inner
 */
function handleProxyEvent(source, target, eventName, options) {
    options || (options = {});
    var newEventName = options.newEventName;
    var prependSourceArg = options.prependSourceArg;

    source.on(eventName, function () {
        var newArgs = Array.prototype.slice.apply(arguments);
        prependSourceArg && newArgs.unshift(source);

        if (typeof newEventName === 'function') {
            newEventName.apply(target, newArgs);
        }
        else {
            newEventName || (newEventName = eventName);
            newArgs.unshift(newEventName);
            target.emit.apply(target, newArgs);
        }
    });
}

/**
 * 代理给定的源对象的事件，并将其转发给目标对象
 *
 * @param  {EventEmitter} source 被代理的源对象
 * @param  {EventEmitter} target 要转发给的目标对象
 * @param  {string|Array.<string>|Object} events 要代理的事件名称
 *         可以传入一个Object对象，key为原始对象名称，
 *         value为代理后要发射的新的事件名称或自定义的处理方法，
 *         如果要维持跟原来一样置为空串即可。
 * @param {boolean=} prependSourceArg 是否要追加事件源的 `source` 参数到 `target` 的
 *                                    事件回调参数里，可选，默认false
 * @example
 *     // 代理一个事件
 *     proxyEvents(source, target, 'change');
 *
 *     // 代理多个事件
 *     proxyEvents(source, target, ['change', 'add']);
 *
 *     // 自定义事件名称，change代理后变成myChange，add维持不变, 自定义的delete处理事件
 *     proxyEvents(source, target, { change: 'myChange', add: '', delete: function () {} });
 */
exports.proxyEvents = function (source, target, events, prependSourceArg) {
    var isArr = Array.isArray(events);
    if (!isArr && typeof events === 'string') {
        events = [
            events
        ];
        isArr = true;
    }

    var eventName;
    /* eslint-disable fecs-no-forin-array */
    for (var k in events) {
        if (events.hasOwnProperty(k)) {
            eventName = isArr ? events[k] : k;
            handleProxyEvent(source, target, eventName, {
                newEventName: isArr ? '' : events[k],
                prependSourceArg: prependSourceArg
            });
        }
    }
    /* eslint-enable fecs-no-forin-array */
};

/**
 * 绑定监听器
 *
 * @param {EventEmitter} target 要监听的目标对象
 * @param {Object} listener 要绑定的监听器，key：监听的事件名称，value：监听的事件处理器
 * @param {Object=} context 处理器执行的上下文
 */
exports.bindListeners = function (target, listener, context) {
    if (!listener) {
        return;
    }

    for (var event in listener) {
        if (listener.hasOwnProperty(event)) {
            target.on(event, listener[event].bind(context));
        }
    }
};
