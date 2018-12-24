// 业务逻辑
require.config({
    paths: {
        io: '../libs/socket.io/socket.io',
        eventManager: '../utils/event',
        mediaDevices: '../utils/webrtc',
        controllers: '../utils/controllers',
        orientationControls: '../controls/DeviceOrientationControls',
        orbitControls: '../controls/OrbitControls',
    }
});


define(['io', 'eventManager', 'mediaDevices', 'controllers', 'orientationControls', 'orbitControls'], function (io, eventManager, mediaDevices, Controllers, DeviceOrientationControls, orbitControls) {
    //three.js流程： 创建场景、相机、渲染器、内容、（控制器）；初始化，动画，更新

    let listeners = [];
    let preposition, curposition;
    let currentController;//控制器
    let recognizeImageTimer;//向服务器请求图像识别结果的定时器
    let controller;
    let container = document.getElementById('three-container');

    var canvas;
    var socket;//与服务器建立连接

    let defaultVideoWidth = window.innerWidth;//设置默认值
    let defaultVideoHeight = window.innerHeight;

    function imageControl() {
        currentController = 'imageControl';
        listeners.push('cameraOpened', 'position');
        let preposition = null;//表示上一帧中目标对象的位置
        let curposition = null;//表示当前帧中目标对象的位置

        let imageController = new Controllers.ImageController();
        imageController.init();

        //初始化定位方法，参数：模型大小，焦距
        let modelSize = 35.0; //millimeters毫米
        imageController.posit = new POS.Posit(modelSize, Math.max(imageController.outputCanvas.width, imageController.outputCanvas.height));

        // 向DOM树添加虚拟环境
        let threeController = imageController.threeController;
        container.appendChild(threeController.renderer.domElement);

        // 参数一：处理函数
        // 参数二： 更新方式
        imageController.control(recognizeImage, function () {
            //判断模型位置是否更新
            if (curposition && preposition !== curposition) {
                imageController.locateModel(curposition, modelSize);
                preposition = curposition;
            }
        });

        //监听到后台返回的目标对象的位置信息的处理
        eventManager.listen('position', function (position) {
            curposition = position;
        });
    }


    //开始图像识别，请求当前视频帧中目标图像的位置
    function recognizeImage(video) {
        let default_video_period = 100;
        let video_period = 100;
        if (!socket) {
            //连接服务器端，传输数据
            socket = io.connect('https://10.108.164.203:8081');
            // socket = io.connect('https://10.208.25.196:8081');
            socket.on('frame', function (data) {
                let corners = data.corners;
                if (!corners) return;
                eventManager.trigger('position', corners);
            });
        }

        //定时向后端传输图像数据
        recognizeImageTimer = setInterval(function () {
            sendVideoData(socket, video, video.videoWidth, video.videoHeight);
        }, video_period || default_video_period);
    }

    //停止图像识别
    function stopRecognize() {
        if (!recognizeImageTimer) return;
        clearInterval(recognizeImageTimer);
        recognizeImageTimer = null;
    }

    //发送视频帧
    function sendVideoData(socket, video, width, height) {
        if (!canvas)
            canvas = document.createElement('canvas');

        canvas.width = width || defaultVideoWidth;
        canvas.height = height || defaultVideoHeight;

        let context = canvas.getContext('2d');

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

    function removeImageControl() {
        clear();
        stopRecognize();
        socket.removeAllListeners('frame');
    }

    function clear() {
        for (let i = 0; i < listeners.length; i++) {
            eventManager.remove(listeners[i]);
        }
        listeners = [];
        while (container.hasChildNodes()) //当elem下还存在子节点时 循环继续
        {
            container.removeChild(container.firstChild);
        }
    }

    //用于屏幕触摸，键盘、鼠标控制
    function orbitControl() {
        if (currentController === 'orbitControl') return;
        currentController = 'orbitControl';
        listeners.push('cameraOpened');
        let orbitController = new Controllers.OrbitController();
        orbitController.init();

        let threeController = orbitController.threeController;

        container.appendChild(threeController.renderer.domElement);

        orbitController.control();
    }

    function removeOrbitControl() {
        console.log('removeOrbitControl');
        clear();
    }

    //传感器控制
    function orientationControl() {
        if (currentController === 'orientationControl') return;
        currentController = 'orientationControl';
        listeners.push('cameraOpened');
        let orientationController = new Controllers.OrientationController();
        orientationController.init();

        let threeController = orientationController.threeController;

        container.appendChild(threeController.renderer.domElement);
        orientationController.control()
    }

    function removeOrientationControl() {
        console.log('removeOrientationControl');
        clear();
    }

    /*  //语音控制
      function audioControl() {
          //成功获取音频流的回调函数
          var options;
          var handleSuccess = function (stream) {
              var start = document.createElement('button');
              start.innerText = 'start';
              start.setAttribute('style', "position:absolute;z-index:200;bottom:10px;left:10px");

              var stop = document.createElement('button');
              stop.innerText = 'stop';
              stop.setAttribute('style', "position:absolute;z-index:200;bottom:10px;right:10px");

              var recordedChunks = [];
              var mediaRecorder = new MediaRecorder(stream, options);//创建一个MediaRecord对象

              var container = document.getElementsByClassName('container')[0];
              container.appendChild(start);
              container.appendChild(stop);
              start.onclick = startRecord;
              stop.onclick = stopRecord;

              function startRecord(e) {
                  recordedChunks = [];
                  mediaRecorder.start(1000);
              }

              function stopRecord(e) {
                  mediaRecorder.stop()
              }

              if (MediaRecorder.isTypeSupported('audio/webm')) {
                  options = {mimeType: 'audio/webm'};
              } else {
                  options = null;
              }


              mediaRecorder.ondataavailable = function (e) {
                  if (e.data.size > 0) {
                      recordedChunks.push(e.data);
                  }
              };

              mediaRecorder.addEventListener('stop', function () {
                  console.log("data available after MediaRecorder.stop() called.")
                  getSpeechRecognition(recordedChunks)

              });


          };

          var constraints = {audio: true};
          mediaDevices.getUserMedia(constraints)
              .then(handleSuccess)
              .catch(function (err) {
                  console.log(err.name + ": " + err.message);
              });

          //请求语音识别结果
          function getSpeechRecognition(stream) {
              console.log('get stream')
          }
      }*/


    // 图像识别+手势控制
    function imageOrbitControl() {
        if (currentController === 'imageOrbitControl') return;
        currentController = 'imageOrbitControl';
        listeners.push('cameraOpened');

        let preposition = null;//表示上一帧中目标对象的位置
        let curposition = null;//表示当前帧中目标对象的位置

        let imageOrbitController = new Controllers.ImageOrbitController();
        imageOrbitController.init();

        //初始化定位方法，参数：模型大小，焦距
        let modelSize = 35.0; //millimeters毫米
        imageOrbitController.posit = new POS.Posit(modelSize, Math.max(window.innerWidth, window.innerHeight));

        let threeController = imageOrbitController.threeController;
        container.appendChild(threeController.renderer.domElement);

        imageOrbitController.control(
            function (video) {
                recognizeImage(video);
                document.addEventListener('mouseup', handler, false);

                function handler() {
                    threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
                    threeController.camera.lookAt(threeController.scene.position);
                    document.removeEventListener('mouseup', handler, false);
                    eventManager.trigger('locateModel');
                }
            },
            function () {
                //判断模型位置是否更新
                if (curposition && preposition !== curposition) {
                    imageOrbitController.locateModel(curposition, modelSize);
                    preposition = curposition;
                }
            });

        //监听到后台返回的目标对象的位置信息的处理
        eventManager.listen('position', function (position) {
            curposition = position;
        });

        eventManager.listen('locateModel', function () {
            imageOrbitController.locateModel(curposition, modelSize);
        });
    }

    function removeImageOrbitControl() {
        console.log('removeImageOrbitControl')
        clear()
    }

    function reset(type) {
        if (currentController === 'orbitControl' || currentController === 'imageOrbitControl') {
            //释放所有的鼠标、屏幕、键盘事件监听
            controller.dispose();
        }
        if (currentController === 'imageControl' || currentController === 'imageOrbitControl' || currentController === 'imageOrientControl') {
            curposition = null;
            preposition = null;
            removeImageControl();
        }

        if (camera_model) {
            resetCameraModel();
        }

        if (scene_model) {
            while (scene_model.children.length > 0) {
                scene_model.remove(scene_model.children[0]);
            }
            scene_model.add(camera_model);
        }

        renderer.clear();
        currentController = type;
    }


    //图像识别+传感器方向控制
    function imageOrientationControl() {
        if (currentController === 'imageOrientationControl') return;
        currentController = 'imageOrientationControl';
        listeners.push('cameraOpened', 'position');

        let preposition = null;//表示上一帧中目标对象的位置
        let curposition = null;//表示当前帧中目标对象的位置

        let imageOrientationController = new Controllers.ImageOrientationController();
        imageOrientationController.init();

        //初始化定位方法，参数：模型大小，焦距
        let modelSize = 35.0; //millimeters毫米
        imageOrientationController.posit = new POS.Posit(modelSize, Math.max(window.innerWidth, window.innerHeight));
        let threeController = imageOrientationController.threeController;
        container.appendChild(threeController.renderer.domElement);

        //监听到后台返回的目标对象的位置信息的处理
        eventManager.listen('position', function (position) {
            curposition = position;
        });

        // 参数一：处理函数
        // 参数二： 更新方式
        imageOrientationController.control(recognizeImage, function () {
            //判断模型位置是否更新
            if (curposition && preposition !== curposition) {
                imageOrientationController.locateModel(curposition, modelSize);
                preposition = curposition;
            }
        });
    }

    function removeImageOrientationControl() {
        console.log('removeImageOrientationControl');
        clear();
    }


    function GPSControl() {
        currentController = 'GPSControl';
        listeners.push('cameraOpened', 'address');
        eventManager.listen('address', handleAddress);
        geoFindMe();


        //处理位置信息
        function handleAddress(data) {

            if (!socket) {
                //连接服务器端，传输数据
                socket = io.connect('https://10.108.164.203:8081');

            }
            //由于存在跨域问题，由server获取天气并返回
            socket.on('weather', function (data) {
                showWeather(data.weather);
            });

            //使用websocket传输地理位置信息
            socket.emit('LOC_MESS', JSON.stringify(data));
        }

        //获取地址
        function geoFindMe() {
            console.log('定位位置')
            // 百度地图API功能
            //地图初始化
            let map = new BMap.Map("allmap");

            //GPS坐标转换成百度坐标
            let convertor = new BMap.Convertor();
            let pointArr = [];

            //坐标转换完之后的回调函数
            var translateCallback = function (data) {
                if (data.status === 0) {
                    var point = data.points[0];
                    var gc = new BMap.Geocoder();

                    gc.getLocation(point, function (rs) {
                        var addressComponents = rs.addressComponents;

                        let data = {
                            address: addressComponents,
                        };
                        eventManager.trigger('address', data);

                    });
                }
            };


            if (!navigator.geolocation) {
                console.log('Geolocation is not supported by your browser');
                return;
            }

            function success(position) {
                //GPS坐标
                var latitude = position.coords.latitude;
                var longitude = position.coords.longitude;

                var ggPoint = new BMap.Point(longitude, latitude);
                pointArr.push(ggPoint);

                convertor.translate(pointArr, 1, 5, translateCallback)
            }

            function error() {
                console.log("Unable to retrieve your location");
            }


            navigator.geolocation.getCurrentPosition(success, error);
        }

        //根据天气情况，渲染不同的场景
        function showWeather(weather) {
            console.log(weather.now)
            let points;
            //雪花图片
            let texture = new THREE.TextureLoader().load('../js/textures/snow-32.png');
            let model = initWeatherContent(texture);
            let controller = new Controllers.OrbitController();
            controller.init(model);

            let threeController = controller.threeController;
            threeController.updateCamera({position: {x: 0, y: 0, z: 0}});
            threeController.updateModelPosition({x: 0, y: 0, z: 0});
            container.appendChild(threeController.renderer.domElement);

            controller.control(update);


            //场景中的内容
            function initWeatherContent(texture) {
                let geometry = new THREE.Geometry();
                let pointsMaterial = new THREE.PointsMaterial({
                    size: 2,
                    transparent: true,
                    opacity: 0.8,
                    map: texture,
                    blending: THREE.AdditiveBlending,
                    sizeAttenuation: true,
                    depthTest: false
                });

                let range = 100;
                for (let i = 0; i < 1500; i++) {

                    let vertice = new THREE.Vector3(
                        Math.random() * range - range / 2,
                        Math.random() * range * 1.5,
                        Math.random() * range - range / 2);
                    /* 纵向移动速度 */
                    vertice.velocityY = 0.1 + Math.random() / 3;
                    /* 横向移动速度 */
                    vertice.velocityX = (Math.random() - 0.5) / 3;

                    /* 将顶点加入几何 */
                    geometry.vertices.push(vertice);
                }

                geometry.center();

                points = new THREE.Points(geometry, pointsMaterial);
                points.position.y = -30;

                return points;
            }

            /* 数据更新 */
            function update() {
                let vertices = points.geometry.vertices;
                vertices.forEach(function (v) {

                    v.y = v.y - (v.velocityY);
                    v.x = v.x - (v.velocityX);

                    if (v.y <= 0) v.y = 60;
                    if (v.x <= -20 || v.x >= 20) v.velocityX = v.velocityX * -1;

                });
                /* 顶点变动之后需要更新，否则无法实现雨滴特效 */
                points.geometry.verticesNeedUpdate = true;
            }
        }
    }


    function removeGPSControl() {
        console.log('removeGPSControl');
        clear();
        socket.removeAllListeners('weather');
    }

    function resetControl(type) {
        console.log(currentController);
        switch (currentController) {
            case 'imageControl':
                removeImageControl();
                break;
            case 'orbitControl':
                removeOrbitControl();
                break;
            case 'orientationControl':
                removeOrientationControl();
                break;
            case 'imageOrbitControl':
                removeImageOrbitControl()
                break;
            case 'orientationControl':
                removeOrientationControl();
                break;
            case 'imageOrientationControl':
                removeImageOrientationControl();
                break;
            case 'GPSControl':
                removeGPSControl();
                break;
            default:
                break;
        }
        currentController = type;
    }

    return {
        imageControl: imageControl,
        orbitControl: orbitControl,
        orientationControl: orientationControl,
        imageOrbitControl: imageOrbitControl,
        imageOrientationControl: imageOrientationControl,
        GPSControl: GPSControl,
        resetControl: resetControl,
    }
});