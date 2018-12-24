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

    let defaultWidth = window.innerWidth;
    let defaultHeight = window.innerHeight;
    let preposition, curposition;
    let currentController;//控制器
    let recognizeImageTimer;//向服务器请求图像识别结果的定时器
    let controller;
    let imageOrientationControlModel;

    var canvas, context, posit;
    var modelSize = 35.0; //millimeters毫米
    var video;
    var socket;//与服务器建立连接


    var renderer;
    var scene_bg, camera_bg;//用于渲染摄像头内容
    var scene_model, camera_model;//渲染three.js的虚拟物体
    var model, texture;//model是渲染的虚拟物体，texture渲染物体的纹理
    var step = 0.0;


    let defaultVideoWidth = window.innerWidth;//设置默认值
    let defaultVideoHeight = window.innerHeight;

    let cameraDeviceIds = [];

    //打开摄像头后的处理
    // eventManager.listen('cameraOpened', renderVideo);

    function imageControl() {
        currentController = 'imageControl';
        let preposition = null;//表示上一帧中目标对象的位置
        let curposition = null;//表示当前帧中目标对象的位置

        let imageController = new Controllers.ImageController();
        imageController.init();

        //初始化定位方法，参数：模型大小，焦距
        let modelSize = 35.0; //millimeters毫米
        imageController.posit = new POS.Posit(modelSize, Math.max(imageController.outputCanvas.width, imageController.outputCanvas.height));
        let threeController = imageController.threeController;
        // threeController.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("three-container").appendChild(threeController.renderer.domElement);

        /*let realWorldController = new Controllers.RealWorldController();
*/
        imageController.control(function (video) {
            recognizeImage(video);
        },function () {
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
        /*
               eventManager.listen('cameraOpened', function (stream) {
                   if (!video) {
                       video = document.createElement('video');
                       document.getElementById('container').appendChild(video);
                       video.style.display = 'none';
                       // 旧的浏览器可能没有srcObject
                       if ("srcObject" in video) {
                           video.srcObject = stream;
                       } else {
                           // 防止再新的浏览器里使用它，应为它已经不再支持了
                           video.src = window.URL.createObjectURL(stream);

                       }
                   }
                   video.onloadedmetadata = function (e) {
                       video.play();
                       //以捕捉到的视频流创建现实世界控制器
                       realWorldController.init(video);


                window.addEventListener('resize', onWindowResize, false);
*/
        /*
                animate();
                recognizeImage(video);
            }
        });

            openCamera();

            function animate() {
                 requestAnimationFrame(animate);
                 //更新渲染的现实世界场景
                 realWorldController.update();

                 //判断模型位置是否更新
                 if (curposition && preposition !== curposition) {

                     imageController.locateModel(curposition, modelSize);
                     preposition = curposition;
                 }

                 //放置两个场景
                 threeController.renderer.autoClear = false;
                 threeController.renderer.clear();

                 realWorldController.render(threeController.renderer);
                 threeController.render();
             }*/
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
/*
    //获取视频流
    function renderVideo(stream) {
        video = document.createElement('video');
        document.getElementById('container').appendChild(video);
        video.style.display = 'none';
        // 旧的浏览器可能没有srcObject
        if ("srcObject" in video) {
            video.srcObject = stream;
        } else {
            // 防止再新的浏览器里使用它，应为它已经不再支持了
            video.src = window.URL.createObjectURL(stream);

        }
        video.onloadedmetadata = function (e) {
            video.play();
            initControl();
        }
    }*/

    //发送视频帧
    function sendVideoData(socket, video, width, height) {
        if (!canvas)
            canvas = document.createElement('canvas');

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

    /*   function render() {
           //放置两个场景
           renderer.autoClear = false;
           renderer.clear();

           renderer.render(scene_bg, camera_bg);
           renderer.render(scene_model, came_model);
       }

   /*    //创建渲染器和场景
       function createRenderers() {
           //渲染器
           renderer = new THREE.WebGLRenderer();
           renderer.setClearColor(0xffffff, 1);
           renderer.setSize(window.innerWidth, window.innerHeight);
           document.getElementById("three-container").appendChild(renderer.domElement);
       }

       //向场景中添加内容
       function createScenes() {
   //使用正交投影相机
           scene_bg = new THREE.Scene();
           camera_bg = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5);
           scene_bg.add(camera_bg);

           //使用透视投影相机
           scene_model = new THREE.Scene();
           camera_model = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 1, 1000);
           //若要通过相机控制模型，需要设置相机的position
           camera_model.position.x = 0;
           camera_model.position.y = 0;
           camera_model.position.z = 10;
           camera_model.lookAt(scene_model.position);
           scene_model.add(camera_model);

           //场景添加纹理，实际添加的是以当前视频流为纹理的对象
           texture = createTexture();
           scene_bg.add(texture);
       }

       //创建纹理，以视频流为颜色映射对象
       function createTexture(video) {
           //THREE.Texture():创建一个纹理应用到一个表面或作为反射或折射贴图
           var texture = new THREE.Texture(video),
               object = new THREE.Object3D(),
               geometry = new THREE.PlaneGeometry(1.0, 1.0, 0.0),
               //map:颜色映射，默认为空
               material = new THREE.MeshBasicMaterial({map: texture, depthTest: false, depthWrite: false}),
               mesh = new THREE.Mesh(geometry, material);
           texture.minFilter = THREE.LinearFilter;
           object.position.z = -1;

           object.add(mesh);

           return object;
       }

       //更新场景，根据marker的四个角点的位置放置虚拟物体
       function updateScenes() {
           texture.children[0].material.map.needsUpdate = true;
       }*/

    /*function imageControl() {
        model = createModel();
        scene_model.add(model)

        //监听到后台返回的目标对象的位置信息的处理
        eventManager.listen('position', function (data) {
            let corners = data.corners;
            if (!corners) return;
            eventManager.trigger('locateModel', corners)
        });

        //显示虚拟物体，会将图像的四个角点信息传递给回调函数
        eventManager.listen('locateModel', function (corners) {
            updatePosition(corners);
        });

        let default_video_period = 100;
        let video_period = 100;

        if (!socket) {
            //连接服务器端，传输数据
            socket = io.connect('https://10.108.164.203:8081');
            socket.on('frame', function (data) {

                eventManager.trigger('position', data);
            });
        }

        //定时向后端传输图像数据
        let timer = setInterval(function () {
            if ((currentController !== 'imageControl') && (currentController !== 'imageOrbitControl')) {
                clearInterval(timer);
                timer = null;
            } else {
                sendVideoData(socket, video, video.videoWidth, video.videoHeight);
            }
        }, video_period || default_video_period);
    }*/

    function removeImageControl() {
        eventManager.remove('position');
        eventManager.remove('locateModel');
        eventManager.remove('cameraOpened');
        stopRecognize();
    }


/*    //根据位置更新模型
    function locateModel(markers) {
        var corners, corner, pose, i;

        if (markers.length > 0) {
            corners = markers[0].corners;

            for (i = 0; i < corners.length; ++i) {
                corner = corners[i];

                corner.x = corner.x - (canvas.width / 2);
                corner.y = (canvas.height / 2) - corner.y;
            }

            //根据目标图像四个角点的位置计算出相机的当前姿态
            pose = posit.pose(corners);

            //更新模型的姿态
            updateObject(model, pose.bestRotation, pose.bestTranslation);

            step += 0.025;

            model.rotation.z -= step;
        }
    }*/

 /*   //根据位置更新模型
    function locateModelByImageOrientation(model, markers) {
        console.log('locateModelByImageOrientation');
        var corners, corner, pose, i;

        if (markers.length > 0) {
            corners = markers[0].corners;

            for (i = 0; i < corners.length; ++i) {
                corner = corners[i];

                corner.x = corner.x - (canvas.width / 2);
                corner.y = (canvas.height / 2) - corner.y;
            }

            //根据目标图像四个角点的位置计算出相机的当前姿态
            pose = posit.pose(corners);

            //更新模型的姿态
            // updateObject(model, pose.bestRotation, pose.bestTranslation);

            let translation = pose.bestTranslation;

            model.scale.x = modelSize;
            model.scale.y = modelSize;
            model.scale.z = modelSize;

            model.position.x = translation[0];
            model.position.y = translation[1];
            model.position.z = -translation[2];


            // step += 0.025;

            // model.rotation.z -= step;
        }
    }*/


    /*function updateObject(object, rotation, translation) {
        object.scale.x = modelSize;
        object.scale.y = modelSize;
        object.scale.z = modelSize;

        object.rotation.x = -Math.asin(-rotation[1][2]);
        object.rotation.y = -Math.atan2(rotation[0][2], rotation[2][2]);
        object.rotation.z = Math.atan2(rotation[1][0], rotation[1][1]);

        object.position.x = translation[0];
        object.position.y = translation[1];
        object.position.z = -translation[2];
    }*/


    //初始化webgl相关
    /*function initControl() {
        // canvas = document.getElementById("canvas");
        canvas = document.createElement('canvas');
        context = canvas.getContext("2d");
        canvas.width = defaultWidth;
        canvas.height = defaultHeight;
        //初始化定位方法，参数：模型大小，焦距
        posit = new POS.Posit(modelSize, Math.max(canvas.width, canvas.height));

        createRenderers();
        createScenes();

        /!* 监听事件 *!/
        window.addEventListener('resize', onWindowResize, false);

        tick();
    }*/


    /* 窗口变动触发 */
    function onWindowResize() {
        camera_bg.aspect = window.innerWidth / window.innerHeight;
        camera_bg.updateProjectionMatrix();
        camera_model.aspect = window.innerWidth / window.innerHeight;
        camera_model.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function updatePosition(position) {
        curposition = position;
    }

    //重置相机的位置
    function resetCameraModel() {
        camera_model.position.x = 0
        camera_model.position.y = 0
        camera_model.position.z = 10
        camera_model.lookAt(scene_model.position);
    }

    /*function tick() {
        //告诉浏览器您希望执行动画并请求浏览器在下一次重绘之前调用指定的函数来更新动画
        requestAnimationFrame(tick);
        updateScenes();

        switch (currentController) {
            case 'imageControl':
            case 'imageOrbitControl':
                //判断模型位置是否更新
                if (curposition && preposition !== curposition) {
                    if (!preposition) {
                        scene_model.add(model);
                    }

                    let markers = [{corners: curposition}];
                    locateModel(markers);
                    preposition = curposition;
                }
                break;
            case 'orbitControl':
                break;
            case 'orientationControl':
                break;
            case 'imageOrientationControl':
                //判断模型位置是否更新
                if (curposition && preposition !== curposition) {
                    if (!preposition) {
                        scene_model.add(imageOrientationControlModel);
                    }

                    let markers = [{corners: curposition}];
                    locateModelByImageOrientation(imageOrientationControlModel, markers);
                    preposition = curposition;
                }
                break;
            case 'audioControl':
                break;
            case 'GPSControl':
                /!* 循环渲染 *!/
                eventManager.trigger('weatherUpdate');
                break;
            default:
                ;
        }


        render();
    }*/

    /*    //用于屏幕触摸，键盘、鼠标控制
        function orbitControl() {
            // currentController = 'orbitControl';
            addGeo(scene_model);
            camera_model.position.x = 0
            camera_model.position.y = 0
            camera_model.position.z = 100
            camera_model.lookAt(scene_model.position);
            controller = new orbitControls(camera_model);
        }*/

    //用于屏幕触摸，键盘、鼠标控制
    function orbitControl() {
        if (currentController === 'orbitControl') return;
        currentController = 'orbitControl';
        let orbitController = new Controllers.OrbitController();
        orbitController.init();

        let threeController = orbitController.threeController;

        document.getElementById("three-container").appendChild(threeController.renderer.domElement);

        let realWorldController = new Controllers.RealWorldController();

        eventManager.listen('cameraOpened', function (stream) {
            if (!video) {
                video = document.createElement('video');
                document.getElementById('container').appendChild(video);
                video.style.display = 'none';
                // 旧的浏览器可能没有srcObject
                if ("srcObject" in video) {
                    video.srcObject = stream;
                } else {
                    // 防止再新的浏览器里使用它，应为它已经不再支持了
                    video.src = window.URL.createObjectURL(stream);
                }
            }
            video.onloadedmetadata = function (e) {
                video.play();
                //以捕捉到的视频流创建现实世界控制器
                realWorldController.init(video);
                /* 监听事件 */
                window.addEventListener('resize', onWindowResize, false);

                orbitController.control();
                //更新场景
                animate()
            };

            function animate() {
                requestAnimationFrame(animate);
                //更新渲染的现实世界场景
                realWorldController.update();

                //放置两个场景
                threeController.renderer.autoClear = false;
                threeController.renderer.clear();

                realWorldController.render(threeController.renderer);
                threeController.render();
            }
        });

        openCamera();
    }


    /*function orientationControl() {
        window.addEventListener('deviceorientation', deviceorientation, false);
        initObject(scene_model);
        initCamera(camera_model)

        // var cube;

        function initObject(scene) {
            //坐标轴
            var xmat = new THREE.LineBasicMaterial({color: 0xff0000});
            var xgeo = new THREE.Geometry();
            xgeo.vertices.push(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(300, 0, 0)
            );
            var xline = new THREE.Line(xgeo, xmat);
            // scene.add(xline);

            var ymat = new THREE.LineBasicMaterial({color: 0x00ff00});
            var ygeo = new THREE.Geometry();
            ygeo.vertices.push(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 300, 0)
            );
            var yline = new THREE.Line(ygeo, ymat);
            // scene.add(yline);

            var zmat = new THREE.LineBasicMaterial({color: 0x0000ff});
            var zgeo = new THREE.Geometry();
            zgeo.vertices.push(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 300)
            );
            var zline = new THREE.Line(zgeo, zmat);
            // scene.add(zline);

            //正方体
            // var cubegeo = new THREE.BoxGeometry(100, 200, 20);
            var cubegeo = new THREE.BoxGeometry(1, 1, 1);
            for (var i = 0; i < cubegeo.faces.length; i += 2) {
                var hex = Math.random() * 0xffffff;
                cubegeo.faces[i].color.setHex(hex);
                cubegeo.faces[i + 1].color.setHex(hex);
            }

            var cubemat = new THREE.MeshBasicMaterial({vertexColors: THREE.FaceColors});
            imageOrientationControlModel = new THREE.Mesh(cubegeo, cubemat);
            // imageOrientationControlModel.position.y = 0;
            scene.add(imageOrientationControlModel);
        }


        function initCamera(camera) {
            camera.up.x = 0;
            camera.up.y = 1;//以y轴正方向，默认就是以y轴为正方向
            camera.up.z = 0;

            // camera.lookAt(0,0,0);//相机看向的方向，若不设置，默认为从z轴正方向看向xy平面
        }

        //重力感应事件处理
        function deviceorientation(event) {

            var alpha = event.alpha / 180 * Math.PI;
            var beta = event.beta / 180 * Math.PI;
            var gamma = event.gamma / 180 * Math.PI;

            //var alpha = 120/180*Math.PI;
            //var beta = 0/180*Math.PI;
            //var gamma = 0/180*Math.PI;

            //反转
            var matrix = imageOrientationControlModel.matrix.clone();
            matrix.getInverse(matrix);
            imageOrientationControlModel.applyMatrix(matrix);

            //单个旋转正常
            //cube.rotateZ(alpha);
            //cube.rotateX(beta);
            //cube.rotateY(gamma);

            //使用旋转矩阵
            var rz = new THREE.Matrix4();
            rz.set(Math.cos(-alpha), Math.sin(-alpha), 0, 0,
                -Math.sin(-alpha), Math.cos(-alpha), 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1);
            //cube.applyMatrix(rz);

            var rx = new THREE.Matrix4();
            rx.set(1, 0, 0, 0,
                0, Math.cos(-beta), Math.sin(-beta), 0,
                0, -Math.sin(-beta), Math.cos(-beta), 0,
                0, 0, 0, 1);
            //cube.applyMatrix(rx);

            var ry = new THREE.Matrix4();
            ry.set(Math.cos(-gamma), 0, -Math.sin(-gamma), 0,
                0, 1, 0, 0,
                Math.sin(-gamma), 0, Math.cos(-gamma), 0,
                0, 0, 0, 1);
            //cube.applyMatrix(ry);

            //欧拉角顺序应该为ZXY，另外需要注意的是前边参数的顺序和后边设置的顺序不是一一对应的，也就是说就算顺序被设置为ZXY，前边三个参数的顺序依然XYZ
            var euler = new THREE.Euler();
            euler.set(beta, gamma, alpha, 'ZXY');
            imageOrientationControlModel.setRotationFromEuler(euler);

            requestAnimationFrame(tick);
        }
    }*/

    //传感器控制
    function orientationControl() {
        if (currentController === 'orientationControl') return;
        currentController = 'orientationControl';
        let orientationController = new Controllers.OrientationController();
        orientationController.init();

        let threeController = orientationController.threeController;

        document.getElementById("three-container").appendChild(threeController.renderer.domElement);

        let realWorldController = new Controllers.RealWorldController();

        eventManager.listen('cameraOpened', function (stream) {
            if (!video) {
                video = document.createElement('video');
                document.getElementById('container').appendChild(video);
                video.style.display = 'none';
                // 旧的浏览器可能没有srcObject
                if ("srcObject" in video) {
                    video.srcObject = stream;
                } else {
                    // 防止再新的浏览器里使用它，应为它已经不再支持了
                    video.src = window.URL.createObjectURL(stream);
                }
            }
            video.onloadedmetadata = function (e) {
                video.play();
                //以捕捉到的视频流创建现实世界控制器
                realWorldController.init(video);
                /* 监听事件 */
                window.addEventListener('resize', onWindowResize, false);

                orientationController.control();
                animate();
            };

            function animate() {
                requestAnimationFrame(animate);
                //更新渲染的现实世界场景
                realWorldController.update();

                //放置两个场景
                threeController.renderer.autoClear = false;
                threeController.renderer.clear();

                realWorldController.render(threeController.renderer);
                threeController.render();
            }
        });

        openCamera();
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

    /*    function imageOrbitControl() {
            imageControl();

            augumentedTHREE();

            controller = new THREE.OrbitControls(camera_model);

        }*/

    // 图像识别+手势控制
    function imageOrbitControl() {
        if (currentController === 'imageOrbitControl') return;
        currentController = 'imageOrbitControl';

        let preposition = null;//表示上一帧中目标对象的位置
        let curposition = null;//表示当前帧中目标对象的位置

        let imageOrbitController = new Controllers.ImageOrbitController();
        imageOrbitController.init();

        //初始化定位方法，参数：模型大小，焦距
        let modelSize = 35.0; //millimeters毫米
        imageOrbitController.posit = new POS.Posit(modelSize, Math.max(window.innerWidth, window.innerHeight));
        let threeController = imageOrbitController.threeController;
        document.getElementById("three-container").appendChild(threeController.renderer.domElement);

        let realWorldController = new Controllers.RealWorldController();

        //监听到后台返回的目标对象的位置信息的处理
        eventManager.listen('position', function (position) {
            curposition = position;
        });
        eventManager.listen('locateModel', function () {
            imageOrbitController.locateModel(curposition, modelSize);
        });
        eventManager.listen('cameraOpened', function (stream) {
            if (!video) {
                video = document.createElement('video');
                document.getElementById('container').appendChild(video);
                video.style.display = 'none';
                // 旧的浏览器可能没有srcObject
                if ("srcObject" in video) {
                    video.srcObject = stream;
                } else {
                    // 防止再新的浏览器里使用它，应为它已经不再支持了
                    video.src = window.URL.createObjectURL(stream);
                }
            }
            video.onloadedmetadata = function (e) {
                video.play();
                //以捕捉到的视频流创建现实世界控制器
                realWorldController.init(video);
                /* 监听事件 */
                window.addEventListener('resize', onWindowResize, false);


                recognizeImage(video);
                imageOrbitController.control(function () {
                    eventManager.trigger('locateModel');
                });
                animate();
            }

        });


        function animate() {
            requestAnimationFrame(animate);
            //更新渲染的现实世界场景
            realWorldController.update();

            //判断模型位置是否更新
            if (curposition && preposition !== curposition) {

                imageOrbitController.locateModel(curposition, modelSize);
                preposition = curposition;
            }

            //放置两个场景
            threeController.renderer.autoClear = false;
            threeController.renderer.clear();

            realWorldController.render(threeController.renderer);
            threeController.render();
        }

        openCamera();
    }

    /*function argumentTHREE() {
        //构造函数
        THREE.OrbitControls = function (object, domElement) {

            this.mouseDown = false;
            this.object = object;

            this.domElement = (domElement !== undefined) ? domElement : document;

            // Set to false to disable this control
            this.enabled = true;

            // "target" sets the location of focus, where the object orbits around（target属性表示物体旋转的中心）
            this.target = new THREE.Vector3();

            // How far you can dolly in and out ( PerspectiveCamera only )（可以移动的位置范围，仅支持透视投影相机）
            this.minDistance = 0;
            this.maxDistance = Infinity;

            // How far you can zoom in and out ( OrthographicCamera only )（可以缩放的方位，仅支持正交投影相机）
            this.minZoom = 0;
            this.maxZoom = Infinity;

            // How far you can orbit（旋转） vertically（垂直地）, upper and lower limits.（可以垂直旋转的范围）
            // Range is 0 to Math.PI radians.（0~π）
            this.minPolarAngle = 0; // radians
            this.maxPolarAngle = Math.PI; // radians

            // How far you can orbit horizontally（水平的）, upper and lower limits.（可以水平旋转的范围）
            // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
            this.minAzimuthAngle = -Infinity; // radians
            this.maxAzimuthAngle = Infinity; // radians

            // Set to true to enable damping（抑制） (inertia（惯性）)（enableDamping用于抑制惯性的效果）
            // If damping is enabled, you must call controls.update() in your animation loop（若设置enableDamping为true，需要在动画循环中调用controls.update()更新）
            this.enableDamping = false;
            this.dampingFactor = 0.25;

            // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.（enableZoom用于设置是否允许缩放）
            // Set to false to disable zooming
            this.enableZoom = true;
            this.zoomSpeed = 1.0;

            // Set to false to disable rotating
            this.enableRotate = true;
            this.rotateSpeed = 1.0;

            // Set to false to disable panning
            this.enablePan = true;
            this.panSpeed = 1.0;
            this.screenSpacePanning = false; // if true, pan in screen-space
            this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

            // Set to true to automatically rotate around the target
            // If auto-rotate is enabled, you must call controls.update() in your animation loop
            this.autoRotate = false;
            this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

            // Set to false to disable use of the keys（是否允许使用键控制）
            this.enableKeys = true;

            // The four arrow keys
            this.keys = {LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40};

            // Mouse buttons
            this.mouseButtons = {LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE, RIGHT: THREE.MOUSE.RIGHT};

            // for reset（用于重置？？？？）
            this.target0 = this.target.clone();
            this.position0 = this.object.position.clone();
            this.zoom0 = this.object.zoom;

            //
            // public methods
            //

            //获取极角
            this.getPolarAngle = function () {

                return spherical.phi;

            };

            //获取方位角
            this.getAzimuthalAngle = function () {

                return spherical.theta;

            };

            //保存状态
            this.saveState = function () {
                //scope指向this，当前构造的对象
                scope.target0.copy(scope.target);
                scope.position0.copy(scope.object.position);
                scope.zoom0 = scope.object.zoom;

            };

            //重置
            this.reset = function () {
                //scope指向this，当前构造的对象
                scope.target.copy(scope.target0);
                scope.object.position.copy(scope.position0);
                scope.object.zoom = scope.zoom0;

                scope.object.updateProjectionMatrix();
                scope.dispatchEvent(changeEvent);

                scope.update();

                state = STATE.NONE;

            };

            // this method is exposed, but perhaps it would be better if we can make it private...（update方法被暴露出来，若是将它设置为私有方法更好）
            this.update = function () {

                var offset = new THREE.Vector3();

                // so camera.up is the orbit axis
                //setFromUnitVectors(vFrom,vTo)：将该四元数设置为由vFrom向量到vTo向量所需要的旋转量
                var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));//由object.up和一个向量生成一个四元数
                var quatInverse = quat.clone().inverse();//求这个四元数的倒数——计算共轭，然后使结果标准化。

                var lastPosition = new THREE.Vector3();
                var lastQuaternion = new THREE.Quaternion();

                return function update() {

                    var position = scope.object.position;

                    //计算物体位置与旋转中心的偏移量，其实就是得出在当前球面坐标系中，物体的位置
                    offset.copy(position).sub(scope.target);

                    // rotate offset to "y-axis-is-up" space 通过四元数旋转物体。
                    offset.applyQuaternion(quat);

                    // angle from z-axis around y-axis（从z轴到y轴的角度）基于offset向量设置spherical的radius，phi（与y轴正方向的夹角）和theta（绕y轴旋转的角度）属性
                    spherical.setFromVector3(offset);

                    //若设置了自动旋转，切虚拟物体无状态，向左旋转
                    if (scope.autoRotate && state === STATE.NONE) {

                        rotateLeft(getAutoRotationAngle());

                    }

                    spherical.theta += sphericalDelta.theta;
                    spherical.phi += sphericalDelta.phi;

                    // 将theta和phi的值限定在期望范围内
                    // restrict theta to be between desired limits
                    spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));

                    // restrict phi to be between desired limits
                    spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));

                    //确保phi值在正常范围内
                    spherical.makeSafe();


                    //球面坐标系的半径缩放
                    spherical.radius *= scale;

                    // restrict radius to be between desired limits
                    spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

                    // move target to panned location 将中心点移动到平移到的位置
                    scope.target.add(panOffset);

                    //获取物体在球面坐标中的坐标
                    offset.setFromSpherical(spherical);

                    // rotate offset back to "camera-up-vector-is-up" space 偏移量旋转回“相机-向上-矢量-向上”空间
                    offset.applyQuaternion(quatInverse);

                    //重新计算得到物体的当前位置
                    position.copy(scope.target).add(offset);

                    scope.object.lookAt(scope.target);

                    if (scope.enableDamping === true) {

                        sphericalDelta.theta *= (1 - scope.dampingFactor);
                        sphericalDelta.phi *= (1 - scope.dampingFactor);

                        panOffset.multiplyScalar(1 - scope.dampingFactor);

                    } else {

                        sphericalDelta.set(0, 0, 0);

                        //平移量清空
                        panOffset.set(0, 0, 0);

                    }

                    scale = 1;

                    // update condition is:
                    // min(camera displacement, camera rotation in radians)^2 > EPS
                    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

                    if (zoomChanged ||
                        lastPosition.distanceToSquared(scope.object.position) > EPS ||
                        8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {

                        scope.dispatchEvent(changeEvent);

                        lastPosition.copy(scope.object.position);
                        lastQuaternion.copy(scope.object.quaternion);
                        zoomChanged = false;

                        return true;

                    }

                    return false;

                };

            }();

            //移除所有事件监听器
            this.dispose = function () {

                scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
                scope.domElement.removeEventListener('mousedown', onMouseDown, false);
                scope.domElement.removeEventListener('wheel', onMouseWheel, false);

                scope.domElement.removeEventListener('touchstart', onTouchStart, false);
                scope.domElement.removeEventListener('touchend', onTouchEnd, false);
                scope.domElement.removeEventListener('touchmove', onTouchMove, false);

                document.removeEventListener('mousemove', onMouseMove, false);
                document.removeEventListener('mouseup', onMouseUp, false);

                window.removeEventListener('keydown', onKeyDown, false);

                //scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

            };

            //
            // internals（内部构件）
            //

            var scope = this;

            var changeEvent = {type: 'change'};
            var startEvent = {type: 'start'};
            var endEvent = {type: 'end'};

            var STATE = {NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY_PAN: 4};

            var state = STATE.NONE;

            var EPS = 0.000001;

            // current position in spherical coordinates（在球面坐标中的当前位置）
            var spherical = new THREE.Spherical();//Spherical(radius, phi, theta)：radius默认1.0，以y轴正方向为向上，phi表示与y轴正方向的夹角，theta表示绕y轴旋转的值，默认都为0
            var sphericalDelta = new THREE.Spherical();

            var scale = 1;
            var panOffset = new THREE.Vector3();//平移量{x:0,y:0,z:0}
            var zoomChanged = false;

            var rotateStart = new THREE.Vector2();//{x:0,y:0}
            var rotateEnd = new THREE.Vector2();
            var rotateDelta = new THREE.Vector2();

            var panStart = new THREE.Vector2();
            var panEnd = new THREE.Vector2();
            var panDelta = new THREE.Vector2();

            var dollyStart = new THREE.Vector2();
            var dollyEnd = new THREE.Vector2();
            var dollyDelta = new THREE.Vector2();

            function getAutoRotationAngle() {

                return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

            }

            //获取缩放比例，默认缩放比例为1
            function getZoomScale() {

                return Math.pow(0.95, scope.zoomSpeed);

            }

            //向左旋转
            function rotateLeft(angle) {

                sphericalDelta.theta -= angle;

            }

            //向上旋转
            function rotateUp(angle) {

                sphericalDelta.phi -= angle;

            }

            //向左平移
            var panLeft = function () {

                var v = new THREE.Vector3();

                return function panLeft(distance, objectMatrix) {

                    v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix（获取物体姿态矩阵的表示X的列）
                    v.multiplyScalar(-distance);//向左为负

                    panOffset.add(v);

                };

            }();

            //向上平移
            var panUp = function () {

                var v = new THREE.Vector3();

                return function panUp(distance, objectMatrix) {

                    if (scope.screenSpacePanning === true) {

                        v.setFromMatrixColumn(objectMatrix, 1);//取出表示Y轴的列

                    } else {

                        v.setFromMatrixColumn(objectMatrix, 0);
                        v.crossVectors(scope.object.up, v);

                    }

                    v.multiplyScalar(distance);

                    panOffset.add(v);

                };

            }();

            // deltaX and deltaY are in pixels; right and down are positive（deltaX和deltaY是以像素为单位，向右和向下为正）
            var pan = function () {

                var offset = new THREE.Vector3();

                return function pan(deltaX, deltaY) {

                    var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

                    if (scope.object.isPerspectiveCamera) {
                        //对于透视投影相机的处理

                        // perspective
                        var position = scope.object.position;
                        offset.copy(position).sub(scope.target);//计算出偏移量offset
                        var targetDistance = offset.length();

                        // half of the fov is center to top of screen
                        targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0);

                        // we use only clientHeight here so aspect ratio does not distort speed（为保证不会长宽比不会扭曲速度，此处使用clientHeight）
                        panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
                        panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);

                    } else if (scope.object.isOrthographicCamera) {
                        //对于正交投影相机的处理
                        // orthographic
                        panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix);
                        panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix);

                    } else {

                        // camera neither orthographic nor perspective
                        console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
                        scope.enablePan = false;

                    }

                };

            }();

            /!**
             * 放大，整部摄影机向前移动
             * @param dollyScale 缩放比例
             *!/
            function dollyIn(dollyScale) {

                if (scope.object.isPerspectiveCamera) {

                    scale /= dollyScale;

                } else if (scope.object.isOrthographicCamera) {

                    scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale));
                    scope.object.updateProjectionMatrix();
                    zoomChanged = true;

                } else {

                    console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
                    scope.enableZoom = false;

                }

            }

            /!**
             * 缩小，整部摄影机向后移动
             * @param dollyScale 缩放比例
             *!/
            function dollyOut(dollyScale) {

                if (scope.object.isPerspectiveCamera) {

                    scale *= dollyScale;

                } else if (scope.object.isOrthographicCamera) {

                    scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale));
                    scope.object.updateProjectionMatrix();
                    zoomChanged = true;

                } else {

                    console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
                    scope.enableZoom = false;

                }

            }

            //
            // event callbacks - update the object state（回调事件 - 更新虚拟物体的状态）
            //

            //处理鼠标按下旋转事件
            function handleMouseDownRotate(event) {

                //console.log( 'handleMouseDownRotate' );

                //设置旋转的初态
                rotateStart.set(event.clientX, event.clientY);

            }

            function handleMouseDownDolly(event) {

                //console.log( 'handleMouseDownDolly' );

                dollyStart.set(event.clientX, event.clientY);

            }

            function handleMouseDownPan(event) {

                //console.log( 'handleMouseDownPan' );

                panStart.set(event.clientX, event.clientY);

            }

            //处理鼠标按下移动导致的旋转事件
            function handleMouseMoveRotate(event) {

                //console.log( 'handleMouseMoveRotate' );

                //设置旋转的终态
                rotateEnd.set(event.clientX, event.clientY);

                //基于初始状态和结束状态，计算差值，再乘上旋转速度，得到旋转量
                rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

                var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

                //计算出向左旋转角度和向上旋转角度
                rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height

                rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

                //以当前的终态作为下次鼠标移动的初态
                rotateStart.copy(rotateEnd);

                //更新虚拟物体状态
                scope.update();

            }

            function handleMouseMoveDolly(event) {

                //console.log( 'handleMouseMoveDolly' );

                dollyEnd.set(event.clientX, event.clientY);

                dollyDelta.subVectors(dollyEnd, dollyStart);

                if (dollyDelta.y > 0) {

                    dollyIn(getZoomScale());

                } else if (dollyDelta.y < 0) {

                    dollyOut(getZoomScale());

                }

                dollyStart.copy(dollyEnd);

                scope.update();

            }

            function handleMouseMovePan(event) {

                //console.log( 'handleMouseMovePan' );

                panEnd.set(event.clientX, event.clientY);

                panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

                pan(panDelta.x, panDelta.y);

                panStart.copy(panEnd);

                scope.update();

            }

            function handleMouseUp(event) {

                // console.log( 'handleMouseUp' );

            }

            function handleMouseWheel(event) {

                // console.log( 'handleMouseWheel' );

                if (event.deltaY < 0) {

                    dollyOut(getZoomScale());

                } else if (event.deltaY > 0) {

                    dollyIn(getZoomScale());

                }

                scope.update();

            }

            function handleKeyDown(event) {

                //console.log( 'handleKeyDown' );

                switch (event.keyCode) {

                    case scope.keys.UP:
                        pan(0, scope.keyPanSpeed);
                        scope.update();
                        break;

                    case scope.keys.BOTTOM:
                        pan(0, -scope.keyPanSpeed);
                        scope.update();
                        break;

                    case scope.keys.LEFT:
                        pan(scope.keyPanSpeed, 0);
                        scope.update();
                        break;

                    case scope.keys.RIGHT:
                        pan(-scope.keyPanSpeed, 0);
                        scope.update();
                        break;

                }

            }

            function handleTouchStartRotate(event) {

                //console.log( 'handleTouchStartRotate' );

                rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);

            }

            function handleTouchStartDollyPan(event) {

                //console.log( 'handleTouchStartDollyPan' );

                if (scope.enableZoom) {

                    var dx = event.touches[0].pageX - event.touches[1].pageX;
                    var dy = event.touches[0].pageY - event.touches[1].pageY;

                    var distance = Math.sqrt(dx * dx + dy * dy);

                    dollyStart.set(0, distance);

                }

                if (scope.enablePan) {

                    var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
                    var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

                    panStart.set(x, y);

                }

            }

            function handleTouchMoveRotate(event) {

                //console.log( 'handleTouchMoveRotate' );

                rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);

                rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

                var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

                rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height

                rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

                rotateStart.copy(rotateEnd);

                scope.update();

            }

            function handleTouchMoveDollyPan(event) {

                //console.log( 'handleTouchMoveDollyPan' );

                if (scope.enableZoom) {

                    var dx = event.touches[0].pageX - event.touches[1].pageX;
                    var dy = event.touches[0].pageY - event.touches[1].pageY;

                    var distance = Math.sqrt(dx * dx + dy * dy);

                    dollyEnd.set(0, distance);

                    dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed));

                    dollyIn(dollyDelta.y);

                    dollyStart.copy(dollyEnd);

                }

                if (scope.enablePan) {

                    var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
                    var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

                    panEnd.set(x, y);

                    panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

                    pan(panDelta.x, panDelta.y);

                    panStart.copy(panEnd);

                }

                scope.update();

            }

            function handleTouchEnd(event) {

                //console.log( 'handleTouchEnd' );

            }

            //
            // event handlers - FSM: listen for events and reset state（事件句柄 - 根据不同的事件触发情况添加对应的回调处理函数以及重置状态）
            //

            function onMouseDown(event) {

                if (scope.enabled === false) return;

                event.preventDefault();

                switch (event.button) {

                    case scope.mouseButtons.LEFT://若是按下鼠标左键

                        if (event.ctrlKey || event.metaKey) {//判断是否按下控制平移的按键

                            if (scope.enablePan === false) return;

                            handleMouseDownPan(event);

                            state = STATE.PAN;

                        } else {//发出旋转事件

                            //若不允许旋转，返回。不响应鼠标事件
                            if (scope.enableRotate === false) return;

                            //执行鼠标按下旋转的处理函数
                            handleMouseDownRotate(event);

                            //将状态切换成旋转
                            state = STATE.ROTATE;

                        }

                        break;

                    case scope.mouseButtons.MIDDLE://若是按下鼠标滚轮，进入"缩放"处理流程

                        //若不允许缩放，返回
                        if (scope.enableZoom === false) return;

                        //执行鼠标按下缩放的处理函数
                        handleMouseDownDolly(event);

                        //将状态切换成缩放状态
                        state = STATE.DOLLY;

                        break;

                    case scope.mouseButtons.RIGHT://若是按下鼠标右键

                        //若不允许平移，返回
                        if (scope.enablePan === false) return;

                        //执行鼠标按下平移的处理函数
                        handleMouseDownPan(event);

                        //将状态切换成平移状态
                        state = STATE.PAN;

                        break;

                }

                if (state !== STATE.NONE) {//若存在一种状态，继续监听鼠标的移动以及抬起

                    document.addEventListener('mousemove', onMouseMove, false);
                    document.addEventListener('mouseup', onMouseUp, false);

                    //触发startEvent事件
                    scope.dispatchEvent(startEvent);

                }

            }

            //鼠标移动处理事件
            function onMouseMove(event) {

                if (scope.enabled === false) return;

                event.preventDefault();

                switch (state) {

                    case STATE.ROTATE:

                        if (scope.enableRotate === false) return;

                        handleMouseMoveRotate(event);
                        break;

                    case STATE.DOLLY:

                        if (scope.enableZoom === false) return;

                        handleMouseMoveDolly(event);

                        break;

                    case STATE.PAN:

                        if (scope.enablePan === false) return;

                        handleMouseMovePan(event);

                        break;

                }

            }

            function onMouseUp(event) {

                if (scope.enabled === false) return;

                handleMouseUp(event);

                document.removeEventListener('mousemove', onMouseMove, false);
                document.removeEventListener('mouseup', onMouseUp, false);

                scope.dispatchEvent(endEvent);

                state = STATE.NONE;

            }

            function onMouseWheel(event) {

                if (scope.enabled === false || scope.enableZoom === false || (state !== STATE.NONE && state !== STATE.ROTATE)) return;

                event.preventDefault();
                event.stopPropagation();

                scope.dispatchEvent(startEvent);

                handleMouseWheel(event);

                scope.dispatchEvent(endEvent);

            }

            function onKeyDown(event) {

                if (scope.enabled === false || scope.enableKeys === false || scope.enablePan === false) return;

                handleKeyDown(event);

            }

            function onTouchStart(event) {

                if (scope.enabled === false) return;

                event.preventDefault();

                switch (event.touches.length) {

                    case 1:	// one-fingered touch: rotate

                        if (scope.enableRotate === false) return;

                        handleTouchStartRotate(event);

                        state = STATE.TOUCH_ROTATE;

                        break;

                    case 2:	// two-fingered touch: dolly-pan

                        if (scope.enableZoom === false && scope.enablePan === false) return;

                        handleTouchStartDollyPan(event);

                        state = STATE.TOUCH_DOLLY_PAN;

                        break;

                    default:

                        state = STATE.NONE;

                }

                if (state !== STATE.NONE) {

                    scope.dispatchEvent(startEvent);

                }

            }

            function onTouchMove(event) {

                if (scope.enabled === false) return;

                event.preventDefault();
                event.stopPropagation();

                switch (event.touches.length) {

                    case 1: // one-fingered touch: rotate

                        if (scope.enableRotate === false) return;
                        if (state !== STATE.TOUCH_ROTATE) return; // is this needed?

                        handleTouchMoveRotate(event);

                        break;

                    case 2: // two-fingered touch: dolly-pan

                        if (scope.enableZoom === false && scope.enablePan === false) return;
                        if (state !== STATE.TOUCH_DOLLY_PAN) return; // is this needed?

                        handleTouchMoveDollyPan(event);

                        break;

                    default:

                        state = STATE.NONE;

                }

            }

            function onTouchEnd(event) {

                if (scope.enabled === false) return;

                handleTouchEnd(event);

                scope.dispatchEvent(endEvent);

                state = STATE.NONE;

            }

            function onContextMenu(event) {

                if (scope.enabled === false) return;

                event.preventDefault();

            }

            //添加事件监听器

            scope.domElement.addEventListener('contextmenu', onContextMenu, false);

            scope.domElement.addEventListener('mousedown', onMouseDown, false);
            scope.domElement.addEventListener('wheel', onMouseWheel, false);

            scope.domElement.addEventListener('touchstart', onTouchStart, false);
            scope.domElement.addEventListener('touchend', onTouchEnd, false);
            scope.domElement.addEventListener('touchmove', onTouchMove, false);

            window.addEventListener('keydown', onKeyDown, false);

            // force an update at start（在刚开始时强制更新）

            this.update();

        };

//覆写原型
        THREE.OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
//修改原型的构造函数指向为指向自身
        THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

//给原型添加某些属性
        Object.defineProperties(THREE.OrbitControls.prototype, {

            center: {
                get: function () {

                    console.warn('THREE.OrbitControls: .center has been renamed to .target');
                    return this.target;

                }

            },

            // backward compatibility

            noZoom: {

                get: function () {

                    console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
                    return !this.enableZoom;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
                    this.enableZoom = !value;

                }

            },

            noRotate: {

                get: function () {

                    console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
                    return !this.enableRotate;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
                    this.enableRotate = !value;

                }

            },

            noPan: {

                get: function () {

                    console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
                    return !this.enablePan;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
                    this.enablePan = !value;

                }

            },

            noKeys: {

                get: function () {

                    console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
                    return !this.enableKeys;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
                    this.enableKeys = !value;

                }

            },

            staticMoving: {

                get: function () {

                    console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
                    return !this.enableDamping;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
                    this.enableDamping = !value;

                }

            },

            dynamicDampingFactor: {

                get: function () {

                    console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
                    return this.dampingFactor;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
                    this.dampingFactor = value;

                }

            }

        });
    }*/


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
    /*    function imageOrientationControl() {
            orientationControl();
            //监听到后台返回的目标对象的位置信息的处理
            eventManager.listen('position', function (data) {
                let corners = data.corners;
                if (!corners) return;
                eventManager.trigger('locateModel', corners)
            });

            //显示虚拟物体，会将图像的四个角点信息传递给回调函数
            eventManager.listen('locateModel', function (corners) {
                updatePosition(corners);
            });

            let default_video_period = 100;
            let video_period = 100;

            if (!socket) {
                //连接服务器端，传输数据
                socket = io.connect('https://10.108.164.203:8081');
                socket.on('frame', function (data) {

                    eventManager.trigger('position', data);
                });
            }

            //定时向后端传输图像数据
            let timer = setInterval(function () {
                if ((currentController !== 'imageControl') && (currentController !== 'imageOrbitControl') && (currentController !== 'imageOrientationControl')) {
                    clearInterval(timer);
                    timer = null;
                } else {
                    sendVideoData(socket, video, video.videoWidth, video.videoHeight);
                }
            }, video_period || default_video_period);
        }*/

    function imageOrientationControl() {
        if (currentController === 'imageOrientationControl') return;
        currentController = 'imageOrientationControl';

        let preposition = null;//表示上一帧中目标对象的位置
        let curposition = null;//表示当前帧中目标对象的位置

        let imageOrientationController = new Controllers.ImageOrientationController();
        imageOrientationController.init();

        //初始化定位方法，参数：模型大小，焦距
        let modelSize = 35.0; //millimeters毫米
        imageOrientationController.posit = new POS.Posit(modelSize, Math.max(window.innerWidth, window.innerHeight));
        let threeController = imageOrientationController.threeController;
        document.getElementById("three-container").appendChild(threeController.renderer.domElement);

        let realWorldController = new Controllers.RealWorldController();

        //监听到后台返回的目标对象的位置信息的处理
        eventManager.listen('position', function (position) {
            curposition = position;
        });

        eventManager.listen('cameraOpened', function (stream) {
            if (!video) {
                video = document.createElement('video');
                document.getElementById('container').appendChild(video);
                video.style.display = 'none';
                // 旧的浏览器可能没有srcObject
                if ("srcObject" in video) {
                    video.srcObject = stream;
                } else {
                    // 防止再新的浏览器里使用它，应为它已经不再支持了
                    video.src = window.URL.createObjectURL(stream);
                }
            }
            video.onloadedmetadata = function (e) {
                video.play();
                //以捕捉到的视频流创建现实世界控制器
                realWorldController.init(video);
                /* 监听事件 */
                window.addEventListener('resize', onWindowResize, false);
                recognizeImage(video);
                imageOrientationController.control()
                animate();

            }

        });


        function animate() {
            requestAnimationFrame(animate);
            //更新渲染的现实世界场景
            realWorldController.update();

            //判断模型位置是否更新
            if (curposition && preposition !== curposition) {
                imageOrientationController.locateModel(curposition, modelSize);
                preposition = curposition;
            }

            //放置两个场景
            threeController.renderer.autoClear = false;
            threeController.renderer.clear();

            realWorldController.render(threeController.renderer);
            threeController.render();
        }

        openCamera();
    }


    function GPSControl() {
        eventManager.listen('address', handleAddress);
        geoFindMe();

        //处理位置信息
        function handleAddress(data) {
            console.log(data)
            if (!socket) {
                //连接服务器端，传输数据
                socket = io.connect('https://10.108.164.203:8081');

                //由于存在跨域问题，由server获取天气并返回
                socket.on('weather', function (data) {
                    showWeather(data.weather);
                });
            }

            //使用websocket传输地理位置信息
            socket.emit('LOC_MESS', JSON.stringify(data));
        }

        //获取地址
        function geoFindMe() {
            // 百度地图API功能
            //地图初始化
            var map = new BMap.Map("allmap");

            //GPS坐标转换成百度坐标
            var convertor = new BMap.Convertor();
            var pointArr = [];

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


    }

    //根据天气情况，渲染不同的场景
    function showWeather(weather) {
        console.log(weather.now)
        let points, controls;
        //雪花图片
        let texture = new THREE.TextureLoader().load('../js/textures/snow-32.png');

        initControls();
        initWeatherContent(texture);
        eventManager.listen('weatherUpdate', update);

        //控制器
        function initControls() {
            controls = new orbitControls(camera_model, renderer.domElement)
        }

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

            scene_model.add(points);
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

    /**
     * 打开摄像头，得到视频流
     * @param callback 具有默认参数视频流stream
     */
    function openCamera() {
        mediaDevices.enumerateDevices().then(function (devices) {
            //获取设备信息
            devices.forEach(device => {
                if (device.kind === 'videoinput') {
                    cameraDeviceIds.push(device.deviceId);
                }
            });
        }).then(function () {
            let defaultVideoConstraints = {
                width: defaultVideoWidth,
                height: defaultVideoHeight,
                deviceId: cameraDeviceIds[1]
            };

            let constraints = {video: defaultVideoConstraints};
            return mediaDevices.getUserMedia(constraints).then(stream => {
                eventManager.trigger('cameraOpened', stream);
            })
        });
    }


    return {
        // initControl: initControl,
        imageControl: imageControl,
        orbitControl: orbitControl,
        orientationControl: orientationControl,
        // audioControl: audioControl,
        imageOrbitControl: imageOrbitControl,
        imageOrientationControl: imageOrientationControl,
        // resetCameraModel: resetCameraModel,
        GPSControl: GPSControl,
        // showWeather: showWeather,
        reset: reset,
    }
});