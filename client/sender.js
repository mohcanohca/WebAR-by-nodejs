//存储设备的方向信息
let deviceOrientation = {
    thetax: 0,
    thetay: 0,
    thetaz: 0,
    absolute: false
};

//存储设备的位置
let devicePosition = {
    x: 0,
    y: 0,
    z: 0
};

let imu = {};//存储设备的运动信息
let interval = 0;

let width=640;//设置默认值
let height=480;

function handleOrientation(event) {
    deviceOrientation.thetax = event.beta;
    deviceOrientation.thetay = event.gamma;
    deviceOrientation.thetaz = event.alpha;
    deviceOrientation.absolute = event.absolute;
}

//监听手机移动事件，更新旋转数据
function handleMotion(event) {
    let rates = event.rotationRate;//旋转速率，度/s
    let accelerate = event.accelerationIncludingGravity;
    interval = event.interval;//从底层硬件获取数据的时间间隔，ms
    let rz = rates.alpha;
    let ry = rates.gamma;
    let rx = rates.beta;

    imu.rx = rx;
    imu.ry = ry;
    imu.rz = rz;
    imu.interval = interval;
    imu.accelerate = accelerate;
}

//发送视频帧
function sendVideoData(video) {
    var canvas = document.getElementById('canvas');
    console.log(video.width,video.height);
    if (width && height) {
        canvas.width = width;
        canvas.height = height;
        let context = canvas.getContext('2d');
/*        canvasFace.width = width;
        canvasFace.height = height;*/

        context.drawImage(video, 0, 0, width, height, 0, 0, width, height);
        let jpgQuality = 0.6;
        let theDataURL = canvas.toDataURL('image/jpeg', jpgQuality);//转换成base64编码
        let data = {
            imgData: theDataURL,
        };
        //使用websocket进行图像传输
        socket.emit('VIDEO_MESS', JSON.stringify(data));
    }
}

//对navigator做兼容处理
function compatibleNavigator() {
    //用来适配旧版的浏览器
    const promisifiedOldGUM = function (constraints) {
        // 进行能力检测
        // First get ahold of getUserMedia, if present
        let getUserMedia = (navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia);

        // 有些浏览器没有实现getUserMedia，返回一个reject状态的Promise
        if (!getUserMedia) {
            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        // 否则，使用Promise包装过去的navigator.getUserMedia用法
        return new Promise(function (resolve, reject) {
            getUserMedia.call(navigator, constraints, resolve, reject);
        });
    };

    // 老版本的浏览器可能没有实现mediaDevices，先将其设置为一个空对象
    if (navigator.mediaDevices === undefined) {
        navigator.mediaDevices = {};
    }

    /*     一些浏览器部分实现了mediaDevices。我们不能只用getUserMedia指定一个对象，
         因为getUserMedia会覆盖现有的属性。
         如果getUserMedia丢失，只添加getUserMedia属性*/
    if (navigator.mediaDevices.getUserMedia === undefined) {
        navigator.mediaDevices.getUserMedia = promisifiedOldGUM;
    }
}




(function () {
    compatibleNavigator();
    window.addEventListener("deviceorientation", handleOrientation, true);
    window.addEventListener("devicemotion", handleMotion, true);

    function sendIMUData() {
        socket.emit('IMU_MESS', JSON.stringify(imu));
    }

    let cameraDeviceIds = [];
    navigator.mediaDevices.enumerateDevices().then(function (mediaDevices) {
        //获取设备信息
        mediaDevices.forEach(mediaDevice => {
            if (mediaDevice.kind === 'videoinput') {
                // const option = document.createElement('option');
                cameraDeviceIds.push(mediaDevice.deviceId);
            }
        });
    }).then(sendData);

    //前后端通信
    function sendData() {
        let videoConstraints = {
            width: 640,
            height: 480,
            deviceId: cameraDeviceIds[1]
        };

        let constraints = {video: videoConstraints};
        let video_period = 1000;

        navigator.mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
                var video = document.getElementById('video');
                // 旧的浏览器可能没有srcObject
                if ("srcObject" in video) {
                    video.srcObject = stream;
                } else {
                    // 防止再新的浏览器里使用它，应为它已经不再支持了
                    video.src = window.URL.createObjectURL(stream);
                }
                video.onloadedmetadata = function (e) {
                    video.play();
                    width = video.videoWidth;
                    height = video.videoHeight;

                    //定时向后端传输图像数据和imu数据
                    setInterval(function () {
                        sendVideoData(video)
                    }, video_period);

                    //定时传送IMU数据
                    setInterval(sendIMUData, 100);//interval=16
                };

            })
            .catch(function (err) {
                alert(err.name + ": " + err.message);
            });
    }
})();