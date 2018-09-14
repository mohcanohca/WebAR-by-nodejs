var socket = io.connect('https://10.108.166.159:8081');
let send_time,receive_time;
send_time=receive_time=(new Date()).getTime();

//获取用于绘制目标图像位置的canvas画布
var canvasFace = document.getElementById('canvas-face');
var ctx = canvasFace.getContext('2d');

var test=document.getElementById('test');
socket.on('frame', handlePosition);

function handlePosition(data) {
    receive_time=(new Date()).getTime();
    let period=receive_time-send_time;
    test.innerText='时间差：'+period+'\n'+test.innerText;
    // console.log('时间差：'+period);
    calTransformByIMU(imu,period);
/*    let canvasFace = document.getElementById('canvas-face');
    let ctx = canvasFace.getContext('2d');*/
    // let rotation = null, transition = null;
    ctx.clearRect(0, 0, canvasFace.width, canvasFace.height);
    ctx.strokeStyle = "red";
/*    rotation = data.rotation;
    transition = data.transition;*/

    let points = data.position;
    if (!points) return;
    ctx.beginPath();
    for (let point of points) {
        let x = point.x;
        let y = point.y;
        // ctx.arc(x, y, 5, 0, Math.PI * 2, true); // 绘制
        ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.closePath();
}

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

function squareMatrixMultiply(A, B) {
    var n = A.length;
    var C = [];
    for (var i = 0; i < n; i++) {
        C[i] = [];
        for (var j = 0; j < n; j++) {
            C[i][j] = 0;
            for (var k = 0; k < n; k++) {
                C[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    return C;
}

/**
 * 根据imu信息计算转换信息
 * @param rotation imu旋转信息
 * @param period
 * @returns {{rMat: Mat, tMat: {tx: number, ty: number, tz: number}}}
 */
function calTransformByIMU(rotation, period) {
    console.log('imu加速度：' + rotation.accelerate.x, rotation.accelerate.y, rotation.accelerate.z);
    console.log('imu旋转角速度：' + rotation.rx, rotation.ry, rotation.rz);

    //a. 根据绕各个轴的加速度，双重积分得出在各个轴的平移量
    let tx = rotation.accelerate.x * period * Math.pow(0.100, 2) / 2;
    let ty = rotation.accelerate.y * period * Math.pow(0.100, 2) / 2;
    let tz = rotation.accelerate.z * period * Math.pow(0.100, 2) / 2;

    //b. 计算旋转角，旋转速率是度/s
    let angle_z = rotation.rz * period;
    let angle_y = rotation.ry * period;
    let angle_x = rotation.rx * period;

    test.innerText='imu平移量：' + tx/*+''+ty+''+tz*/+'\n'+test.innerText;
    console.log('imu平移量：' + tx, ty, tz);
    console.log('imu旋转角度：' + angle_x, angle_y, angle_z);

    //由在x轴的旋转角计算在x轴的旋转矩阵
    let arr_x = [
        [1, 0, 0],
        [0, Math.cos(angle_x), -Math.sin(angle_x)],
        [0, Math.sin(angle_x), Math.cos(angle_x)],
    ];

    //由在y轴的旋转角计算在y轴的旋转矩阵
    let arr_y = [
        [Math.cos(angle_y), 0, Math.sin(angle_y)],
        [0, 1, 0],
        [-Math.sin(angle_y), 0, Math.cos(angle_y)],
    ];

    //由在z轴的旋转角计算在z轴的旋转矩阵
    let arr_z = [
        [Math.cos(angle_z), -Math.sin(angle_z), 0],
        [Math.sin(angle_z), Math.cos(angle_z), 0],
        [0, 0, 1],
    ];

    //上面三个旋转矩阵相乘，得出最终的旋转矩阵（由于不知道矩阵乘法如何使用，此处手动计算相乘结果，直接设置了结果）
    /* let temRot = new cv.Mat(3, 3, cv.CV_64F);
     temRot.set(0, 0, Math.cos(angle_y) * Math.cos(angle_z));
     temRot.set(0, 1, -Math.cos(angle_y) * Math.sin(angle_z));
     temRot.set(0, 2, Math.sin(angle_y));
     temRot.set(1, 0, Math.sin(angle_x) * Math.sin(angle_y) * Math.cos(angle_z) + Math.cos(angle_x) * Math.sin(angle_z));
     temRot.set(1, 1, -Math.sin(angle_x) * Math.sin(angle_y) * Math.sin(angle_z) * Math.cos(angle_z) + Math.cos(angle_x) * Math.cos(angle_z));
     temRot.set(1, 2, -Math.sin(angle_x) * Math.cos(angle_y));
     temRot.set(2, 0, -Math.cos(angle_x) * Math.sin(angle_y) * Math.cos(angle_z) + Math.sin(angle_x) * Math.sin(angle_z));
     temRot.set(2, 1, Math.cos(angle_x) * Math.sin(angle_y) * Math.sin(angle_z) + Math.sin(angle_x) * Math.cos(angle_z));
     temRot.set(2, 2, Math.cos(angle_x) * Math.cos(angle_y));*/

    let temRot=squareMatrixMultiply(squareMatrixMultiply(arr_x,arr_y),angle_z);


    //打印出由imu旋转角得到的旋转信息，mat3x3
    for (let i = 0; i < temRot.length; i++) {
        console.log(temRot[i,0], temRot[i,1], temRot[i,2]);
    }

    return {
        rMat: temRot,
        tMat: {
            tx,
            ty,
            tz
        }
    };
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

        send_time=(new Date()).getTime();
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
                        sendVideoData(video);
                    }, video_period);

                    //定时传送IMU数据
                    // setInterval(sendIMUData, 100);//interval=16
                };

            })
            .catch(function (err) {
                alert(err.name + ": " + err.message);
            });
    }
})();