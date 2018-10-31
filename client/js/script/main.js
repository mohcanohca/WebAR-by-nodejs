require.config({
    paths: {
        io: '../libs/socket.io/socket.io',
        eventManager: '../libs/event',
        mediaDevices: '../script/webrtc'
    }
});

require(['io', 'eventManager', 'mediaDevices'], function (io, eventManager, mediaDevices) {
    let loadModel = initThree(640, 480, document.getElementById('WebGL-output'));
    //监听到后台返回的目标对象的位置信息的处理
    eventManager.listen('position', handlePosition);
    //打开摄像头后的处理
    eventManager.listen('camera', sendData);
    //显示虚拟物体
    eventManager.listen('showModel', loadModel);


    //连接服务器端，传输数据
    const socket = io.connect('https://10.108.164.203:8081');
    socket.on('frame', function (pos) {
        eventManager.trigger('position', pos);
    });

    let canvas = document.getElementById('canvas');//用于绘制摄像头捕捉内容
    let canvasFace = document.getElementById('canvas-face');//用于绘制目标图像出现的位置
    let ctx = canvasFace.getContext('2d');

    let defaultVideoWidth = 640;//设置默认值
    let defaultVideoHeight = 480;
    let defaultThreeWidth = 640;
    let defaultThreeHeight = 480;


    function handlePosition(data) {
        // calTransformByIMU(imu, period);
        // let rotation = null, transition = null;
        ctx.clearRect(0, 0, 640, 480);
        ctx.fillStyle = "red";
        /*    rotation = data.rotation;
            transition = data.transition;*/

        let points = data.position;
        if (!points) return;

        let center;
        let sumx = 0;
        let sumy = 0;
        let count = 0;
        for (let p of points) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            if (points.x < 0 || points.x > 640 || points.y < 0 || points.y > 480) continue;
            sumx += p.x;
            sumy += p.y;
            count++;
        }
        center = {
            x: sumx / count,
            y: sumy / count
        };

        eventManager.trigger('showModel', center)
    }

    //初始化three.js相关环境
    function initThree(width, height, container) {
        // 创建一个场景，它能放置所有元素，如网格对象、摄像机、灯光等
        let scene = new THREE.Scene();
        scene.background = 'transparent';

        // 创建一个摄像机
        //arg1：摄像机能看到的视野，推荐默认值为50
        //arg2：渲染结果的横向尺寸和纵向尺寸的比值
        //arg3：从距离摄像机多近的距离开始渲染，推荐默认值0.1
        //arg4：摄像机从它所处的位置开始能看到多远。若过小，那么场景中的远处不会被渲染，推荐默认值1000

        width = width || defaultThreeWidth;
        height = height || defaultThreeHeight;
        let camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

        // 设置摄像机位置，并将其朝向场景中心
        camera.position.x = 0
        camera.position.y = 0
        camera.position.z = 200
        camera.lookAt(scene.position);
        scene.add(camera);

        // 添加环境光，用于提亮场景
        let ambientLight = new THREE.AmbientLight(0x0c0c0c);
        scene.add(ambientLight);

        // 添加聚光灯
        let spotLight = new THREE.SpotLight(0xffffff);
        spotLight.position.set(-40, 60, -10);

        scene.add(spotLight);

        // 创建一个渲染器，并设置其清除颜色和大小
        // var renderer = new THREE.WebGLRenderer({alpha: true});
        var renderer = new THREE.CanvasRenderer({alpha: true});
        // renderer.setClearColor(0xffffff, 1.0);
        renderer.setSize(width, height);

        // 将渲染器的输出（canvas）插入到特定 DOM 元素下
        if (container) {
            container.appendChild(renderer.domElement);
        } else {
            //若没有提供three.js的输出容器，创建一个容器
            let body = document.body;
            container = document.createElement('div');
            container.style.width = width + 'px';
            container.style.height = height + 'px';
            container.style.position = 'absolute';
            container.style.top = '0px';
            container.style.left = '0px';
            container.style.zIndex = 999;
            body.appendChild(container);
            container.appendChild(renderer.domElement);
        }
        render();

        function render() {
            // render using requestAnimationFrame
            renderer.render(scene, camera);
            requestAnimationFrame(render);
        }

        let originModel;
        return function (center, model) {
            if (originModel) scene.remove(originModel);

            if (!model) {
                // 创建一个立方体
                let cubeGeometry = new THREE.BoxGeometry(40, 40, 40);
                let cubeMaterial = new THREE.MeshLambertMaterial({color: 0xff0000});
                originModel = new THREE.Mesh(cubeGeometry, cubeMaterial);
            } else {
                originModel = model;
            }
            // model = model;
            // 设置立方体的位置
            originModel.position.x = (center.x - width / 2) / 2;
            originModel.position.y = (center.y - height / 2) / 2;
            // cube.position.x = 20;
            // cube.position.y = 10;
            originModel.position.z = 0;
            console.log(originModel.position.x, originModel.position.y, originModel.position.z)

            // 添加虚拟物体至场景
            scene.add(originModel);
        };
    }

    /*
    //存储设备的位置
    let devicePosition = {
        x: 0,
        y: 0,
        z: 0
    };
  */
    let imu = {};//存储设备的运动信息
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
    }

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
        eventManager.trigger('camera');
    });

    //前后端通信
    function sendData(videoConstraints, video_period) {

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

