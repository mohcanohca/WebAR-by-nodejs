//用来适配旧版的浏览器
const promisifiedOldGUM = function(constraints) {
    // 进行能力检测
    // First get ahold of getUserMedia, if present
    let getUserMedia = (navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia);

    // 有些浏览器没有实现getUserMedia，返回一个reject状态的Promise
    // Some browsers just don't implement it - return a rejected promise with an error
    // to keep a consistent interface
    if(!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
    }

    // 否则，使用Promise包装过去的navigator.getUserMedia用法
    // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
    return new Promise(function(resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
    });

}

// 老版本的浏览器可能没有实现mediaDevices，先将其设置为一个空对象
if(navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
}

/*     一些浏览器部分实现了mediaDevices。我们不能只用getUserMedia指定一个对象，
     因为getUserMedia会覆盖现有的属性。
     如果getUserMedia丢失，只添加getUserMedia属性*/
if(navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = promisifiedOldGUM;
}
module.exports={
    getUserMedia:navigator.mediaDevices.getUserMedia
}
