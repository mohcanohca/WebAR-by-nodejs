require.config({
    paths: {
        io: '../libs/socket.io/socket.io',
        eventManager: './event',
        mediaDevices: './webrtc',
        ControlCenter: './ControlCenter'
    }
});

require(['io', 'eventManager', 'mediaDevices', 'ControlCenter'], function (io, eventManager, mediaDevices, ControlCenter) {

    // let loadmodel = ControlCenter.init(640, 480, document.getElementById('WebGL-output'));

    //打开摄像头后的处理
    eventManager.listen('cameraOpened', renderVideo);

    eventManager.listen('changeControl', handleChangeControl);

    eventManager.listen('imageControl', handleImageControl)
    eventManager.listen('orbitControl', handleOrbitControl)
    eventManager.listen('fusionControl', handleFusionControl)
    eventManager.listen('sensorControl', handleSensorControl)
    eventManager.listen('audioControl', handleAudioControl)

    let currentController = 'imageControl';

    function handleChangeControl(type) {
        eventManager.remove('changeControl');//移除对于changeControl监听，稍后重新添加监听


        currentController = type;
        ControlCenter.reset();

        /*        switch (type) {
                    case 'imageControl':
                        handleImageControl()
                        break;
                    case 'orbitControl':
                        handleOrbitControl()
                        break;
                    case 'fusionControl':
                        handleFusionControl()
                        break;
                    case 'sensorControl':
                        handleSensorControl()
                        break;
                    case 'audioControl':
                        handleAudioControl()
                        break;
                    default:
                        handleImageControl()
                }*/
        eventManager.trigger(type);
        eventManager.listen('changeControl', handleChangeControl);
    }

    let controllers = document.getElementById('controllers');

    let video;//存放视频流的DOM元素

    controllers.addEventListener('click', function (e) {
        let controllerID = e.target.id;
        if (controllerID) {
            eventManager.trigger('changeControl', controllerID);
        }
    });


    //图像识别交互控制
    function handleImageControl() {
        console.log('图像识别交互控制');

        //监听到后台返回的目标对象的位置信息的处理
        eventManager.listen('position', function (data) {
            let corners = data.corners;
            if (!corners) return;

            //绘制目标图像的四个角点
            // drawCorners(corners);
            eventManager.trigger('locateModel', corners)
        });

        //显示虚拟物体，会将图像的四个角点信息传递给回调函数
        eventManager.listen('locateModel', function (corners) {
            ControlCenter.locateModel(corners);
            // eventManager.remove('locateModel');
        });

        let default_video_period = 100;
        let video_period = 100;

        //连接服务器端，传输数据
        // const socket = io.connect('https://10.108.164.203:8081');
        const socket = io.connect('https://127.0.0.1:8081');
        socket.on('frame', function (data) {
            eventManager.trigger('position', data);
        });

        //定时向后端传输图像数据
        let timer = setInterval(function () {
            if ((currentController !== 'imageControl') && (currentController !== 'fusionControl')) {
                clearInterval(timer);
                timer = null;
            } else {
                sendVideoData(socket, video, video.videoWidth, video.videoHeight);
            }
        }, video_period || default_video_period);
    }

    //触摸屏、键盘、鼠标控制
    function handleOrbitControl() {
        console.log('触摸屏、键盘、鼠标控制')
        ControlCenter.orbitControl();
    }

    function handleFusionControl() {
        console.log('图像识别与手动混合控制')
        handleImageControl();
        handleOrbitControl();
    }

    //传感器控制
    function handleSensorControl() {
        console.log('传感器控制')
        ControlCenter.orientationControl();
    }

    //语音控制
    function handleAudioControl() {
        console.log('语音控制')
        ControlCenter.audioControl();
    }


    let canvas = document.getElementById('canvas');//用于绘制摄像头捕捉内容
    // let canvasFrame = document.getElementById('canvas-frame');//用于绘制目标图像出现的位置
    // let canvas_frame = canvasFrame.getContext('2d');


    let defaultVideoWidth = window.innerWidth;//设置默认值
    let defaultVideoHeight = window.innerHeight;

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

    //获取视频流
    function renderVideo(cameraDeviceIds, videoConstraints) {
        let defaultVideoConstraints = {
            width: defaultVideoWidth,
            height: defaultVideoHeight,
            deviceId: cameraDeviceIds[1]
        };

        let constraints = {video: videoConstraints || defaultVideoConstraints};
        // let default_video_period = 100;

        mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
                video = document.getElementById('video');
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
                    ControlCenter.initControl(video, eventManager);

                    //定时向后端传输图像数据和imu数据
                    /*setInterval(function () {
                        sendVideoData(video, video.videoWidth, video.videoHeight);
                    }, video_period || default_video_period);*/
                };

            }).catch(function (err) {
            console.log(err.name + ": " + err.message);
        });
    }

    //发送视频帧
    function sendVideoData(socket, video, width, height) {
        // if (width && height) {
        canvas.width = width || defaultVideoWidth;
        canvas.height = height || defaultVideoHeight;

        let context = canvas.getContext('2d');
        // canvasFrame.width = width;
        // canvasFrame.height = height;

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

