require.config({
    paths: {
        io: '../libs/socket.io/socket.io',
        eventManager: './event',
        mediaDevices: './webrtc',
        modelController: './controlModel'
    }
});

require(['io', 'eventManager', 'mediaDevices', 'modelController'], function (io, eventManager, mediaDevices, modelController) {
    console.log(modelController);

    // let loadmodel = modelController.init(640, 480, document.getElementById('WebGL-output'));

    //监听到后台返回的目标对象的位置信息的处理
    eventManager.listen('position', handlePosition);
    //打开摄像头后的处理
    eventManager.listen('cameraOpened', sendData);
    //显示虚拟物体
    eventManager.listen('showModel', modelController.update);


    //连接服务器端，传输数据
    const socket = io.connect('https://10.108.164.203:8081');
    socket.on('frame', function (data) {
        eventManager.trigger('position', data);
    });

    let canvas = document.getElementById('canvas');//用于绘制摄像头捕捉内容
    let canvasFace = document.getElementById('canvas-face');//用于绘制目标图像出现的位置
    let ctx = canvasFace.getContext('2d');

    let defaultVideoWidth = 640;//设置默认值
    let defaultVideoHeight = 480;


    //响应后台返回的位置信息
    function handlePosition(data) {
        // calTransformByIMU(imu, period);
        // let rotation = null, transition = null;
        ctx.clearRect(0, 0, 640, 480);
        ctx.fillStyle = "red";

        let corners = data.corners;
        if (!corners) return;

        let center;
        let sumx = 0;
        let sumy = 0;
        let count = 0;
        for (let corner of corners) {
            ctx.beginPath();
            ctx.arc(corner.x, corner.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            // if (corner.x < 0 || corner.x > 640 || corner.y < 0 || corner.y > 480) continue;
            sumx += corner.x;
            sumy += corner.y;
            count++;
        }
        center = {
            x: sumx / count,
            y: sumy / count
        };
        // eventManager.trigger('showModel', center)
        eventManager.trigger('showModel', corners)
    }

    /*let imu = {};//存储设备的运动信息
    let interval = 0;

    //存储设备的方向信息
    let deviceOrientation = {
        thetax: 0,
        thetay: 0,
        thetaz: 0,
        absolute: false
    };

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
    }*/

    // window.addEventListener("deviceorientation", handleOrientation, true);
    // window.addEventListener("devicemotion", handleMotion, true);


    let cameraDeviceIds = [];
    mediaDevices.enumerateDevices().then(function (devices) {
        //获取设备信息
        devices.forEach(device => {
            if (device.kind === 'videoinput') {
                cameraDeviceIds.push(device.deviceId);
            }
        });
    }).then(function () {
        eventManager.trigger('cameraOpened', cameraDeviceIds);
    });

    //前后端通信
    function sendData(cameraDeviceIds, videoConstraints, video_period) {
        let defaultVideoConstraints = {
            width: defaultVideoWidth,
            height: defaultVideoHeight,
            deviceId: cameraDeviceIds[1]
        };

        let constraints = {video: videoConstraints || defaultVideoConstraints};
        let default_video_period = 100;

        mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
                let video = document.getElementById('video');
                // 旧的浏览器可能没有srcObject
                if ("srcObject" in video) {
                    video.srcObject = stream;
                } else {
                    // 防止再新的浏览器里使用它，应为它已经不再支持了
                    video.src = window.URL.createObjectURL(stream);
                }
                video.onloadedmetadata = function (e) {
                    video.play();
                    // width = video.videoWidth;
                    // height = video.videoHeight;

                    //初始化webgl相关
                    modelController.onload(video);

                    //定时向后端传输图像数据和imu数据
                    setInterval(function () {
                        sendVideoData(video, video.videoWidth, video.videoHeight);
                    }, video_period || default_video_period);
                };

            }).catch(function (err) {
            console.log(err.name + ": " + err.message);
        });
    }

    //发送视频帧
    function sendVideoData(video, width, height) {

        // if (width && height) {
        canvas.width = width || defaultVideoWidth;
        canvas.height = height || defaultVideoHeight;

        let context = canvas.getContext('2d');
        canvasFace.width = width;
        canvasFace.height = height;

        //绘制当前视频帧
        context.drawImage(video, 0, 0, width, height, 0, 0, width, height);

        let jpgQuality = 0.6;
        let theDataURL = canvas.toDataURL('image/jpeg', jpgQuality);//转换成base64编码
        let data = {
            imgData: theDataURL,
        };
        //使用websocket进行图像传输
        socket.emit('VIDEO_MESS', JSON.stringify(data));
    }
});

