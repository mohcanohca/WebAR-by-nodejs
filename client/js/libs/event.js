/**
 * Created by Lenovo on 2018/3/13.
 */

define(function () {
    let list = {},
        listen,
        trigger,
        remove;
    //订阅事件
    listen = function (key, fn) {
        //若该事件类型不存在，为其创建一个存放回调函数的数组
        if (!list[key]) {
            list[key] = [];
        }
        //将订阅该事件key的订阅者的回调函数存入
        list[key].push(fn);
    };
    //发布事件
    trigger = function () {
        //获取发布的事件名key从list中取出该key对应的订阅者的回调函数
        let key = Array.prototype.shift.call(arguments),
            fns = list[key];
        if (!fns || fns.length === 0) {
            return false;
        }
        //遍历所有的订阅者，依次执行对应的回调函数
        for (var i = 0, fn; fn = fns[i++];) {
            fn.apply(this, arguments);
        }
    };
    //取消订阅
    remove = function (key, fn) {
        let fns = list[key];
        if (!fns) {
            return false;
        }
        //若fn为空，说明取消对该事件的所有订阅
        if (!fn) {
            fns && (fns.length = 0);
        } else {
            //遍历key对应的回调函数数组，将数组中的fn去除
            for (let i = fns.length - 1; i >= 0; i--) {
                let _fn = fns[i];
                if (_fn === fn) {
                    fns.splice(i, 1);
                }
            }
        }
    };

    return {
        listen: listen,
        trigger: trigger,
        remove: remove,
        show: show
    }
});
