require.config({
    paths: {
        io: '../libs/socket.io/socket.io',
        orbitController: '../utils/OrbitControls',
        eventManager: '../utils/event',
        mediaDevices: '../utils/webrtc',
        posit: '../libs/posit',
        // webxr: '../libs/webxr-polyfill'
    }
});
define(['io', 'utils/OrbitController', 'eventManager', 'mediaDevices', 'posit', /*'webxr'*/], function (io, orbitController, eventManager, mediaDevices, POS/*, WebXR*/) {
    let defaultWidth = window.innerWidth;
    let defaultHeight = window.innerHeight;
    let video;

    window.eventManager = eventManager;

    function createCube(width, height, deep) {
        //正方体
        const materials = [
            new THREE.MeshBasicMaterial({color: 0xff0000}),
            new THREE.MeshBasicMaterial({color: 0x0000ff}),
            new THREE.MeshBasicMaterial({color: 0x00ff00}),
            new THREE.MeshBasicMaterial({color: 0xff00ff}),
            new THREE.MeshBasicMaterial({color: 0x00ffff}),
            new THREE.MeshBasicMaterial({color: 0xffff00})
        ];
        let cubegeo = new THREE.BoxGeometry(width, height, deep);

        const cube = new THREE.Mesh(cubegeo, materials);
        return cube;
    }

    function openCamera() {
        let cameraDeviceIds = [];
        mediaDevices.enumerateDevices().then(function (devices) {
            //获取设备信息
            devices.forEach(device => {
                if (device.kind === 'videoinput') {
                    cameraDeviceIds.push(device.deviceId);
                }
            });
        }).then(function () {
            let defaultVideoConstraints = {
                width: defaultWidth,
                height: defaultHeight,
                deviceId: cameraDeviceIds[1]
            };

            let constraints = {video: defaultVideoConstraints};
            return mediaDevices.getUserMedia(constraints).then(stream => {
                eventManager.trigger('cameraOpened', stream);
            })
        });
    }

    function onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    class ThreeJSController {
        constructor() {
            this.renderer = null;
            this.camera = null;
            this.scene = null;
            this.model = null;
            this.addModel = this.addModel.bind(this);
            this.updateCamera = this.updateCamera.bind(this);
            this.updateModelPosition = this.updateModelPosition.bind(this);
            this.render = this.render.bind(this);
            this.setModelFromMatrixPosition = this.setModelFromMatrixPosition.bind(this)
            this.init();
        }

        //初始化Three.js的必要组件
        init() {
            this.renderer = new THREE.WebGLRenderer();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setClearColor(0xffffff, 1);
            this.camera = new THREE.PerspectiveCamera();
            this.scene = new THREE.Scene();
        }

        addModel(model) {
            if (!this.scene) {
                this.scene = new THREE.Scene();
            }
            if (!model) {
                const geometry = new THREE.BoxBufferGeometry(0.5, 0.5, 0.5);
                const material = new THREE.MeshNormalMaterial();
                // Translate the cube up 0.25m so that the origin of the cube
                // is on its bottom face 向上平移0.25米，使立方体的原点在底面
                geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.25, 0));

                this.model = new THREE.Mesh(geometry, material);
            } else {
                this.model = model;
            }

            this.scene.add(this.model);
        }

        updateModel(modelSize, rotation, translation) {
            if (modelSize) {
                this.model.scale.x = modelSize;
                this.model.scale.y = modelSize;
                this.model.scale.z = modelSize;
            }

            if (rotation) {
                this.model.rotation.x = -Math.asin(-rotation[1][2]);
                this.model.rotation.y = -Math.atan2(rotation[0][2], rotation[2][2]);
                this.model.rotation.z = Math.atan2(rotation[1][0], rotation[1][1]);

            }

            if (translation) {
                this.model.position.x = translation[0];
                this.model.position.y = translation[1];
                this.model.position.z = -translation[2];
            }

        }

        updateModelPosition(position) {
            this.model.position.x = position.x || 0;
            this.model.position.y = position.y || 0;
            this.model.position.z = position.z || 0;
        }

        setScene(scene) {
            this.scene = scene;
        }

        setRendererProps(props) {
            for (let i in props) {
                this.renderer[i] = props[i];
            }
        }

        setThreeCameraProps(props) {
            for (let i in props) {
                this.camera[i] = props[i];
            }
        }

        setModelFromMatrixPosition(matrix) {
            this.model.position.setFromMatrixPosition(matrix)
        }

        updateCamera(pose) {
            if (pose.viewMatrix) {
                // 将camera的matrix与viewMatrix的逆矩阵相乘
                this.camera.matrix.getInverse(pose.viewMatrix);
                //更新世界矩阵。如果父对象发生了形变，那么他的形变需要传递到下面所有的子对象 。
                this.camera.updateMatrixWorld(true);
            }
            if (pose.projectionMatrix) {
                this.camera.projectionMatrix.fromArray(pose.projectionMatrix);
            }
            if (pose.position) {
                this.camera.position.x = this.camera.position.x || pose.position.x || 0;
                this.camera.position.y = this.camera.position.y || pose.position.y || 0;
                this.camera.position.z = this.camera.position.z || pose.position.z || 0;
            }
        }

        //覆写WebGLRender的rend方法
        render(renderer, scene, camera) {
            let _renderer = renderer || this.renderer;
            let _scene = scene || this.scene;
            let _camera = camera || this.camera;

            if (!_renderer) {
                alert('ControllerBase is not inited');
                return;
            }

            _renderer.render(_scene, _camera);
        }
    }

    class ControllerBase {
        constructor() {
            this.outputCanvas = null;
            this.threeController = new ThreeJSController();
            // this.init = this.init.bind(this);
            this.cancelControl = this.cancelControl.bind(this);
            ControllerBase.init.call(this);
        }

        static init() {
            //创建输出上下文
            let canvas = document.createElement('canvas');
            canvas.width = defaultWidth;
            canvas.height = defaultHeight;
            this.outputCanvas = canvas;
        }

        cancelControl() {
            if (this.loop) {
                cancelAnimationFrame(this.loop);
            }
        }
    }

    class ImageController extends ControllerBase {
        constructor() {
            super();
            this.model = null;
            this.posit = null;
            this.threeController = new ThreeJSController();
            this.createModel = this.createModel.bind(this);
            this.locateModel = this.locateModel.bind(this);
            ImageController.init.call(this);
        }

        static init() {
            // super.init.call(this);
            //创建输出上下文
            let threeController = this.threeController;
            // threeController.init();
            let camera = threeController.camera;
            let scene = threeController.scene;
            threeController.setThreeCameraProps({
                fov: 40,
                aspect: window.innerWidth / window.innerHeight,
                near: 1,
                far: 1000
            });
            threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
            camera.lookAt(scene.position);
            /*console.log(this);
            debugger*/
        }

        /**
         * @param callback 自定义的控制方法
         * @param updateCB 更新方法
         */
        control(callback, updateCB) {
            let modelSize = 35.0; //millimeters毫米
            if (!this.posit) {
                this.posit = new POS.Posit(modelSize, Math.max(defaultWidth, defaultHeight));
            }
            let _self = this;
            let realWorldController = new RealWorldController();
            let threeController = this.threeController;

            eventManager.listen('cameraOpened', function (stream) {
                if (!video) {
                    video = document.createElement('video');
                    document.body.appendChild(video);
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
                    window.addEventListener('resize', function () {
                        onWindowResize.call(_self);
                    }, false);

                    animate();

                    callback(video);
                }
            });
            if (!video) {
                // debugger
                openCamera();
            } else {
                //以捕捉到的视频流创建现实世界控制器
                realWorldController.init(video);

                /* 监听事件 */
                window.addEventListener('resize', function () {
                    onWindowResize.call(_self);
                }, false);

                animate();

                callback(video);
            }


            function animate() {
                _self.loop = requestAnimationFrame(animate);
                //更新渲染的现实世界场景
                realWorldController.update();
                updateCB();
                //放置两个场景
                threeController.renderer.autoClear = false;
                threeController.renderer.clear();

                // realWorldController.render(threeController.renderer);
                threeController.render(null, realWorldController.threeController.scene, realWorldController.threeController.camera);
                threeController.render();
            }
        }

        //创建模型
        createModel() {
            let object = new THREE.Object3D(),
                geometry = new THREE.SphereGeometry(0.5, 15, 15, Math.PI),
                loader = new THREE.TextureLoader();
            loader.load("./js/textures/earth.jpg", function (texture) {
                let material = new THREE.MeshBasicMaterial({map: texture});
                let mesh = new THREE.Mesh(geometry, material);
                object.add(mesh);
            });
            //场景添加模型，实际添加以地图图像为贴图的球体
            this.model = object;
            this.threeController.addModel(this.model);
        }

        //定位模型
        locateModel(position, modelSize) {
            if (!this.threeController.model) {
                this.createModel();
            }
            let markers = [{corners: position}];
            let corners, corner, pose, i;

            let size = this.threeController.renderer.getSize();

            if (markers.length > 0) {
                corners = markers[0].corners;

                for (i = 0; i < corners.length; ++i) {
                    corner = corners[i];

                    corner.x = corner.x - (size.width / 2);
                    corner.y = (size.height / 2) - corner.y;
                }

                if (!this.posit) {
                    alert('pose algorithm is not defined');
                    return;
                }
                //根据目标图像四个角点的位置计算出相机的当前姿态
                pose = this.posit.pose(corners);

                //更新模型的姿态
                // updateObject(model, pose.bestRotation, pose.bestTranslation);
                this.threeController.updateModel(modelSize, pose.bestRotation, pose.bestTranslation);
            }
        }

    }

    class RealWorldController extends ControllerBase {
        constructor() {
            super();
            this.model = null;
            this.init = this.init.bind(this);
            this.update = this.update.bind(this);
            this.createTexture = this.createTexture.bind(this);
            // this.render = this.render.bind(this);
        }

        //初始化环境组件
        init(material) {
            let _self = this;
            let threeController = this.threeController;
            /* this.renderer = new THREE.WebGLRenderer();
             this.renderer.setSize(defaultWidth, defaultHeight);
             this.renderer.setClearColor(0xffffff, 1);
             this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5);
             this.scene = new THREE.Scene();
             this.scene.add(this.camera);*/
            threeController.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5);

            if (!material) {
                eventManager.listen('cameraOpened', function (video) {
                    material = video;
                    /*_self.model = _self.createTexture(material);
                    _self.scene.add(_self.model);*/
                    threeController.addModel(_self.createTexture(material));
                });
                openCamera()
            } else {
                threeController.addModel(_self.createTexture(material));
            }
        }

        //更新渲染内容
        update() {
            this.threeController.model.children[0].material.map.needsUpdate = true;
        }

        //创建纹理，以视频流为颜色映射对象
        createTexture(video) {
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
    }

    class OrbitController extends ControllerBase {
        constructor(model) {
            super();
            this.threeController = new ThreeJSController();
            this.orbitControls = null;
            OrbitController.init.call(this, model)
        }

        static init(model) {
            let threeController = this.threeController;
            let camera = threeController.camera;
            let scene = threeController.scene;
            threeController.setThreeCameraProps({
                fov: 40,
                aspect: window.innerWidth / window.innerHeight,
                near: 1,
                far: 1000,
            });
            threeController.updateCamera({position: {x: 0, y: 0, z: 100}});
            camera.lookAt(scene.position);

            if (!model) {
                //添加模型
                threeController.addModel(createCube(10, 10, 10));
            } else {
                threeController.addModel(model);
            }
            threeController.updateModelPosition({x: 0, y: 0, z: 0});
        }

        setModel(model) {
            let threeController = this.threeController;
            threeController.addModel(model);
        }

        control(updateCB) {
            let _self = this;
            let realWorldController = new RealWorldController();
            let threeController = this.threeController;

            eventManager.listen('cameraOpened', function (stream) {
                if (!video) {
                    video = document.createElement('video');
                    document.body.appendChild(video);
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
                    window.addEventListener('resize', function () {
                        onWindowResize.call(_self);
                    }, false);

                    _self.orbitControls = new orbitController(threeController.camera, threeController.renderer.domElement)
                    animate();
                }
            });

            if (!video) {
                openCamera();
            } else {
                //以捕捉到的视频流创建现实世界控制器
                realWorldController.init(video);

                /* 监听事件 */
                window.addEventListener('resize', function () {
                    onWindowResize.call(_self);
                }, false);

                _self.orbitControls = new orbitController(threeController.camera, threeController.renderer.domElement)
                animate();
            }

            function animate() {
                _self.loop = requestAnimationFrame(animate);
                //更新渲染的现实世界场景
                realWorldController.update();
                if (updateCB) {
                    updateCB();
                }

                //放置两个场景
                threeController.renderer.autoClear = false;
                threeController.renderer.clear();

                threeController.render(null, realWorldController.threeController.scene, realWorldController.threeController.camera);
                threeController.render();
            }
        }
    }


    class OrientationController extends ControllerBase {
        constructor(model) {
            super();
            this.threeController = new ThreeJSController();
            OrientationController.init.call(this, model);
        }

        static init(model) {
            let threeController = this.threeController;
            // threeController.init();
            let camera = threeController.camera;
            let scene = threeController.scene;
            threeController.setThreeCameraProps({
                fov: 40,
                aspect: window.innerWidth / window.innerHeight,
                near: 1,
                far: 1000,
                up: {
                    x: 0,
                    y: 1,
                    z: 0
                }
            });
            threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
            camera.lookAt(scene.position);

            if (!model) {
                console.log('手动添加模型')
                //添加模型
                threeController.addModel(createCube(1, 1, 1));
            } else {
                threeController.addModel(model);
            }
        }

        control() {
            let _self = this;
            let realWorldController = new RealWorldController();
            let threeController = this.threeController;

            eventManager.listen('cameraOpened', function (stream) {
                if (!video) {
                    video = document.createElement('video');
                    document.body.appendChild(video);
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
                    window.addEventListener('resize', function () {
                        onWindowResize.call(_self);
                    }, false);

                    let model = threeController.model;

                    window.addEventListener('deviceorientation', function (event) {
                        //重力感应事件处理
                        var alpha = event.alpha / 180 * Math.PI;
                        var beta = event.beta / 180 * Math.PI;
                        var gamma = event.gamma / 180 * Math.PI;

                        //反转
                        let matrix = model.matrix.clone();
                        matrix.getInverse(matrix);
                        model.applyMatrix(matrix);


                        //欧拉角顺序应该为ZXY，另外需要注意的是前边参数的顺序和后边设置的顺序不是一一对应的，也就是说就算顺序被设置为ZXY，前边三个参数的顺序依然XYZ
                        let euler = new THREE.Euler();
                        euler.set(beta, gamma, alpha, 'ZXY');
                        model.setRotationFromEuler(euler);
                    }, false);

                    animate();
                }
            });

            if (!video) {
                openCamera();
            } else {
                //以捕捉到的视频流创建现实世界控制器
                realWorldController.init(video);

                /* 监听事件 */
                window.addEventListener('resize', function () {
                    onWindowResize.call(_self);
                }, false);

                let model = threeController.model;

                window.addEventListener('deviceorientation', function (event) {
                    //重力感应事件处理
                    var alpha = event.alpha / 180 * Math.PI;
                    var beta = event.beta / 180 * Math.PI;
                    var gamma = event.gamma / 180 * Math.PI;

                    //反转
                    let matrix = model.matrix.clone();
                    matrix.getInverse(matrix);
                    model.applyMatrix(matrix);


                    //欧拉角顺序应该为ZXY，另外需要注意的是前边参数的顺序和后边设置的顺序不是一一对应的，也就是说就算顺序被设置为ZXY，前边三个参数的顺序依然XYZ
                    let euler = new THREE.Euler();
                    euler.set(beta, gamma, alpha, 'ZXY');
                    model.setRotationFromEuler(euler);
                }, false);

                animate();
            }


            function animate() {
                _self.loop = requestAnimationFrame(animate);
                //更新渲染的现实世界场景
                realWorldController.update();
                //放置两个场景
                threeController.renderer.autoClear = false;
                threeController.renderer.clear();

                threeController.render(null, realWorldController.threeController.scene, realWorldController.threeController.camera);
                threeController.render();
            }
        }

    }

    class ImageOrbitController extends ImageController {
        constructor(model) {
            super();
            ImageOrbitController.init.call(this, model);
        }

        static init(model) {
            // super.init.call(this);
            let threeController = this.threeController;

            let camera = threeController.camera;
            let scene = threeController.scene;
            threeController.setThreeCameraProps({
                fov: 40,
                aspect: window.innerWidth / window.innerHeight,
                near: 1,
                far: 1000
            });
            threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
            camera.lookAt(scene.position);
        }

        control(callback, updateCB) {
            let _self = this;
            let realWorldController = new RealWorldController();
            let threeController = this.threeController;

            eventManager.listen('cameraOpened', function (stream) {
                if (!video) {
                    video = document.createElement('video');
                    document.body.appendChild(video);
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
                    callback(video);

                    animate();
                    _self.orbitControls = new orbitController(threeController.camera, threeController.renderer.domElement)
                    /* 监听事件 */
                    window.addEventListener('resize', function () {
                        onWindowResize.call(_self);
                    }, false);
                }
            });

            if (!video) {
                openCamera();
            } else {
                //以捕捉到的视频流创建现实世界控制器
                realWorldController.init(video);
                callback(video);

                animate();
                _self.orbitControls = new orbitController(threeController.camera, threeController.renderer.domElement)
                /* 监听事件 */
                window.addEventListener('resize', function () {
                    onWindowResize.call(_self);
                }, false);
            }


            function animate() {
                _self.loop = requestAnimationFrame(animate);
                //更新渲染的现实世界场景
                realWorldController.update();
                updateCB();
                //放置两个场景
                threeController.renderer.autoClear = false;
                threeController.renderer.clear();

                threeController.render(null, realWorldController.threeController.scene, realWorldController.threeController.camera);
                threeController.render();
            }

        }
    }


    class ImageOrientationController extends ImageController {
        constructor() {
            super();
            // this.init = this.init.bind(this);
            this.control = this.control.bind(this)
            // this.init();
            ImageOrientationController.init.call(this);
        }

        static init(model) {
            // super.init.call(this);
            let threeController = this.threeController;
            // threeController.init();
            let camera = threeController.camera;
            let scene = threeController.scene;
            threeController.setThreeCameraProps({
                fov: 40,
                aspect: window.innerWidth / window.innerHeight,
                near: 1,
                far: 1000,
                up: {
                    x: 0,
                    y: 1,
                    z: 0
                }
            });
            threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
            camera.lookAt(scene.position);

            if (!model) {
                //添加模型
                threeController.addModel();
            } else {
                threeController.addModel(model);
            }
        }

        control(callback, updateCB) {
            let _self = this;
            let realWorldController = new RealWorldController();
            let threeController = this.threeController;

            eventManager.listen('cameraOpened', function (stream) {
                if (!video) {
                    video = document.createElement('video');
                    document.body.appendChild(video);
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
                    callback(video);
                    animate();
                    controlModel();
                    /* 监听事件 */
                    window.addEventListener('resize', function () {
                        onWindowResize.call(_self);
                    }, false);
                }
            });

            if (!video) {
                openCamera();
            } else {
                //以捕捉到的视频流创建现实世界控制器
                realWorldController.init(video);
                callback(video);
                animate();
                controlModel();
                /* 监听事件 */
                window.addEventListener('resize', function () {
                    onWindowResize.call(_self);
                }, false);
            }

            function animate() {
                _self.loop = requestAnimationFrame(animate);
                //更新渲染的现实世界场景
                realWorldController.update();
                updateCB();
                //放置两个场景
                threeController.renderer.autoClear = false;
                threeController.renderer.clear();

                threeController.render(null, realWorldController.threeController.scene, realWorldController.threeController.camera);
                threeController.render();
            }

            function controlModel() {
                let model = threeController.model;
                window.addEventListener('deviceorientation', function (event) {
                    //重力感应事件处理
                    let alpha = event.alpha / 180 * Math.PI;
                    let beta = event.beta / 180 * Math.PI;
                    let gamma = event.gamma / 180 * Math.PI;

                    //反转
                    let matrix = model.matrix.clone();
                    matrix.getInverse(matrix);
                    model.applyMatrix(matrix);

                    //欧拉角顺序应该为ZXY，另外需要注意的是前边参数的顺序和后边设置的顺序不是一一对应的，也就是说就算顺序被设置为ZXY，前边三个参数的顺序依然XYZ
                    let euler = new THREE.Euler();
                    euler.set(beta, gamma, alpha, 'ZXY');
                    model.setRotationFromEuler(euler);
                }, false);
            }

        }

        //定位模型
        locateModel(position, modelSize) {
            if (!this.threeController.model) {
                this.createModel();
            }
            let markers = [{corners: position}];
            let corners, corner, pose, i;

            let size = this.threeController.renderer.getSize();

            if (markers.length > 0) {
                corners = markers[0].corners;

                for (i = 0; i < corners.length; ++i) {
                    corner = corners[i];

                    corner.x = corner.x - (size.width / 2);
                    corner.y = (size.height / 2) - corner.y;
                }

                if (!this.posit) {
                    alert('pose algorithm is not defined');
                    return;
                }
                //根据目标图像四个角点的位置计算出相机的当前姿态
                pose = this.posit.pose(corners);

                //更新模型的姿态
                this.threeController.updateModel(modelSize, null, pose.bestTranslation);
            }
        }

    }

    class Reticle extends THREE.Object3D {
        /**
         * @param {XRSession} xrSession
         * @param {THREE.Camera} camera
         */
        constructor(xrSession, camera) {
            super();

            this.loader = new THREE.TextureLoader();

            let geometry = new THREE.RingGeometry(0.1, 0.11, 24, 1);
            let material = new THREE.MeshBasicMaterial({color: 0xffffff});
            // Orient the geometry so its position is flat on a horizontal surface
            //  确定几何图形的方向，使其在水平面上
            geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90)));

            this.ring = new THREE.Mesh(geometry, material);

            geometry = new THREE.PlaneBufferGeometry(0.15, 0.15);
            // Orient the geometry so its position is flat on a horizontal surface,
            // as well as rotate the image so the anchor is facing the user
            //确定几何图形的方向，使其在水平面，同时旋转图像，使锚面向用户
            geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90)));
            geometry.applyMatrix(new THREE.Matrix4().makeRotationY(THREE.Math.degToRad(0)));
            material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0
            });
            this.icon = new THREE.Mesh(geometry, material);

            // Load the anchor texture and apply it to our material
            // once loaded
            this.loader.load('js/textures/Anchor.png', texture => {
                this.icon.material.opacity = 1;
                this.icon.material.map = texture;
            });

            this.add(this.ring);
            this.add(this.icon);

            this.session = xrSession;
            this.visible = false;
            this.camera = camera;
        }

        /**
         * Fires a hit test in the middle of the screen and places the reticle
         * upon the surface if found.
         *在屏幕中心执行击中检测，如果检测到平面，就在上面放置圆环
         * 利用three.js的Raycaster
         *
         * @param {XRCoordinateSystem} frameOfRef
         */
        async update(frameOfRef) {
            this.raycaster = this.raycaster || new THREE.Raycaster();
            this.raycaster.setFromCamera({x: 0, y: 0}, this.camera);
            const ray = this.raycaster.ray;

            const origin = new Float32Array(ray.origin.toArray());
            const direction = new Float32Array(ray.direction.toArray());
            this.session.requestHitTest(origin, direction, frameOfRef)
                .then(hits => {
                    if (hits && hits.length) {
                        const hit = hits[0];
                        const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);

                        // Now apply the position from the hitMatrix onto our model
                        // 使用hitMatrix设置模型位置
                        //setFromMatrixPosition()将返回从矩阵中的元素得到的新的向量值的向量。设置了this.position.x|y|z的值
                        this.position.setFromMatrixPosition(hitMatrix);

                        lookAtOnY(this, this.camera);

                        this.visible = true;
                    }
                }).catch(e => {
                console.log(e)
            })

        }


    }

    function lookAtOnY(looker, target) {
        const targetPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);

        const angle = Math.atan2(targetPos.x - looker.position.x,
            targetPos.z - looker.position.z);

        looker.rotation.set(0, angle, 0);
    }

    function createCubeScene() {
        const scene = new THREE.Scene();

        const materials = [
            new THREE.MeshBasicMaterial({color: 0xff0000}),
            new THREE.MeshBasicMaterial({color: 0x0000ff}),
            new THREE.MeshBasicMaterial({color: 0x00ff00}),
            new THREE.MeshBasicMaterial({color: 0xff00ff}),
            new THREE.MeshBasicMaterial({color: 0x00ffff}),
            new THREE.MeshBasicMaterial({color: 0xffff00})
        ];

        const ROW_COUNT = 4;
        const SPREAD = 1;
        const HALF = ROW_COUNT / 2;
        for (let i = 0; i < ROW_COUNT; i++) {
            for (let j = 0; j < ROW_COUNT; j++) {
                for (let k = 0; k < ROW_COUNT; k++) {
                    const box = new THREE.Mesh(new THREE.BoxBufferGeometry(0.2, 0.2, 0.2), materials);
                    box.position.set(i - HALF, j - HALF, k - HALF);
                    box.position.multiplyScalar(SPREAD);
                    scene.add(box);
                }
            }
        }

        return scene;
    }

    class XRHitController extends ControllerBase {
        constructor(device) {
            super();
            this.device = device;//XRDevice
            this.session = null;//XRSession
            this.gl = null;//three.js渲染使用的上下文环境
            this.reticle = null;//辅助图形，标定平面
            this.getDevice = this.getDevice.bind(this);
            this.getSession = this.getSession.bind(this);
            this.onSessionStarted = this.onSessionStarted.bind(this);
            this.onXRFrame = this.onXRFrame.bind(this);
            this.onClick = this.onClick.bind(this);
        }

        async getDevice() {
            this.device = await navigator.xr.requestDevice();
        }

        async getSession() {
            const ctx = this.outputCanvas.getContext('xrpresent');
            this.session = await this.device.requestSession({
                outputContext: ctx,
                environmentIntegration: true,
            });
        }

        async onSessionStarted() {
            let threeController = this.threeController;
            let _self = this;
            window.addEventListener('resize', function () {
                onWindowResize.call(_self);
            }, false);
            threeController.setRendererProps({
                alpha: true,
                preserveDrawingBuffer: true,
                autoClear: false,
            });
            //创建session的展示层
            this.gl = threeController.renderer.getContext();
            await this.gl.setCompatibleXRDevice(this.device);
            this.session.baseLayer = new XRWebGLLayer(this.session, this.gl);

            threeController.setThreeCameraProps({matrixAutoUpdate: false});

            this.reticle = new Reticle(this.session, threeController.camera);
//添加模型
            threeController.scene.add(this.reticle);

            const geometry = new THREE.BoxBufferGeometry(0.5, 0.5, 0.5);
            const material = new THREE.MeshNormalMaterial();

            // Translate the cube up 0.25m so that the origin of the cube
            // is on its bottom face 向上平移0.25米，使立方体的原点在底面
            geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.25, 0));

            this.model = new THREE.Mesh(geometry, material);

            this.frameOfRef = await this.session.requestFrameOfReference('eye-level');
            this.session.requestAnimationFrame(this.onXRFrame);
            window.addEventListener('click', this.onClick);
        }

        onXRFrame(time, frame) {
            let controller = this.threeController;
            let session = frame.session;
            // 获取设备姿态
            let pose = frame.getDevicePose(this.frameOfRef);

            // Update the reticle's position
            //  更新辅助圆环的位置
            // console.log(this.frameOfRef);
            this.reticle.update(this.frameOfRef);

            // Queue up the next frame
            session.requestAnimationFrame(this.onXRFrame);

            // Bind the framebuffer to our baseLayer's framebuffer
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.session.baseLayer.framebuffer);

            if (pose) {
                // Our XRFrame has an array of views. In the VR case, we'll have
                // two views, one for each eye. In mobile AR, however, we only
                // have one view.
                for (let view of frame.views) {
                    const viewport = session.baseLayer.getViewport(view);
                    // console.log(viewport.width, viewport.height)
                    /*this.renderer.setSize(viewport.width, viewport.height);*/
                    controller.renderer.setSize(viewport.width, viewport.height);

                    // Set the view matrix and projection matrix from XRDevicePose
                    // and XRView onto our THREE.Camera.
                    //设置three.js的相机的投影矩阵
                    //获取视图矩阵
                    const viewMatrix = new THREE.Matrix4().fromArray(pose.getViewMatrix(view));

                    // 将camera的matrix与viewMatrix的逆矩阵相乘

                    //更新世界矩阵。如果父对象发生了形变，那么他的形变需要传递到下面所有的子对象 。

                    controller.updateCamera({projectionMatrix: view.projectionMatrix, viewMatrix})
                    // Render our scene with our THREE.WebGLRenderer
                    controller.render();
                }
            }
        }

        async onClick(e) {
            let controller = this.threeController;
            // The requestHitTest function takes an x and y coordinate in
            // Normalized Device Coordinates, where the upper left is (-1, 1)
            // and the bottom right is (1, -1). This makes (0, 0) our center.
            const x = 0;
            const y = 0;

            // Create a THREE.Raycaster if one doesn't already exist,
            // and use it to generate an origin and direction from
            // our camera (device) using the tap coordinates.
            // Learn more about THREE.Raycaster:
            // https://threejs.org/docs/#api/core/Raycaster
            this.raycaster = this.raycaster || new THREE.Raycaster();

            // setFromCamera(coords,camera)用一个新的原点和方向向量来更新射线（ray）。cords: 鼠标的二维坐标；camera：把射线起点设置在该相机位置处。
            // this.raycaster.setFromCamera({x, y}, this.camera);
            this.raycaster.setFromCamera({x, y}, controller.camera);
            const ray = this.raycaster.ray;

            // Fire the hit test to see if our ray collides with a real
            // surface. Note that we must turn our THREE.Vector3 origin and
            // direction into an array of x, y, and z values. The proposal
            // for `XRSession.prototype.requestHitTest` can be found here:
            // https://github.com/immersive-web/hit-test
            const origin = new Float32Array(ray.origin.toArray());
            const direction = new Float32Array(ray.direction.toArray());
            const hits = await this.session.requestHitTest(origin,
                direction,
                this.frameOfRef);

            // If we found at least one hit...
            if (hits.length) {
                // We can have multiple collisions per hit test. Let's just take the
                // first hit, the nearest, for now.
                const hit = hits[0];

                // Our XRHitResult object has one property, `hitMatrix`, a
                // Float32Array(16) representing a 4x4 Matrix encoding position where
                // the ray hit an object, and the orientation has a Y-axis that corresponds
                // with the normal of the object at that location.
                // Turn this matrix into a THREE.Matrix4().
                const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);


                // Now apply the position from the hitMatrix onto our model.
                this.model.position.setFromMatrixPosition(hitMatrix);

                controller.addModel(this.model);
                controller.setModelFromMatrixPosition(hitMatrix);
            }
        }
    }

    //图像识别定位
    class recognitionCenter {
        constructor() {
            this.socket = null;
            this.serverPath = 'https://10.28.201.198:8081';
            this.timer = null;
            this.canvas = document.createElement('canvas');
            this.corners = null;
            this.start = this.start.bind(this)
            this.stop = this.stop.bind(this)
        }

        start(video, socket) {
            let default_video_period = 100;
            let video_period = 100;
            let _self = this;
            if (!socket) {
                //连接服务器端，传输数据
                socket = io.connect(this.serverPath);
                socket.on('frame', function (data) {
                    let corners = data.corners;
                    if (!corners) return;
                    _self.corners = corners;
                    // eventManager.trigger('position', corners);
                });
            }

            //定时向后端传输图像数据
            this.timer = setInterval(function () {
                sendVideoData(socket, video, video.videoWidth, video.videoHeight);
            }, video_period || default_video_period);

            //发送视频帧
            function sendVideoData(socket, video, width, height) {
                if (!_self.canvas)
                    _self.canvas = document.createElement('canvas');

                _self.canvas.width = width;
                _self.canvas.height = height;

                let context = _self.canvas.getContext('2d');

                //绘制当前视频帧
                context.drawImage(video, 0, 0, width, height, 0, 0, width, height);

                let jpgQuality = 0.6;
                let theDataURL = _self.canvas.toDataURL('image/jpeg', jpgQuality);//转换成base64编码
                let data = {
                    imgData: theDataURL,
                };
                //使用websocket进行图像传输
                socket.emit('VIDEO_MESS', JSON.stringify(data));
            }
        }

        //停止图像识别
        stop() {
            if (!this.timer) return;
            clearInterval(this.timer);
            this.timer = null;
        }

    }

    function XRDetect() {
        // 检测是否支持XR
        if (typeof navigator.XR === 'undefined') {
            console.log('No WebXR API found, usually because the WebXR polyfill has not loaded')
            eventManager.trigger('XRSupported', false);
            return
        }

        // 获取可用的显示，然后请求会话
        // Get displays and then request a session
        navigator.XR.getDisplays().then(displays => {
            if (displays.length == 0) {
                console.log('No displays are available');
                eventManager.trigger('XRSupported', false);
                return
            }

            //检测是否为Chrome Canary
            if (navigator.xr && XRSession.prototype.requestHitTest) {
                navigator.xr.requestDevice().then(device => {
                    const outputCanvas = document.createElement('canvas');
                    const ctx = outputCanvas.getContext('xrpresent');

                    device.supportsSession({
                        outputContext: ctx,
                        environmentIntegration: true,
                    }).then(() => {
                        console.log('Device support AR model')
                        eventManager.trigger('XRSupported', true);
                        return
                    }).catch(e => {
                        eventManager.trigger('XRSupported', false);
                        console.log('Device does not support AR Session')
                        return
                    })
                }).catch(e => {
                    console.log('No XRDevice')
                    eventManager.trigger('XRSupported', false);
                    return
                });

            } else {
                // If `navigator.xr` or `XRSession.prototype.requestHitTest`
                // does not exist, we must display a message indicating there
                // are no valid devices.
                console.log('Browser does not support XR')
                eventManager.trigger('XRSupported', false);
                return;
            }

        }).catch(err => {
            console.error('Error getting XR displays', err)
            console.log('Could not get XR displays')
            eventManager.trigger('XRSupported', false);
            return
        })

        /*if (navigator.xr && XRSession.prototype.requestHitTest) {
            try {
                navigator.xr.requestDevice().then(device => {
                    const outputCanvas = document.createElement('canvas');
                    const ctx = outputCanvas.getContext('xrpresent');

                    device.supportsSession({
                        outputContext: ctx,
                        environmentIntegration: true,
                    }).then(() => {
                        console.log('Device support AR model')
                        eventManager.trigger('XRSupported', true);
                    }).catch(e => {
                        eventManager.trigger('XRSupported', false);
                        console.log('Device does not support AR Session')
                    })
                }).catch(e => {
                    console.log('No XRDevice')
                    eventManager.trigger('XRSupported', false);
                });

            } catch (e) {
                console.log('Browser does not support XR')
                eventManager.trigger('XRSupported', false);
                return;
            }
        } else {
            // If `navigator.xr` or `XRSession.prototype.requestHitTest`
            // does not exist, we must display a message indicating there
            // are no valid devices.
            console.log('Browser does not support XR')
            eventManager.trigger('XRSupported', false);
            return;
        }*/
    }

    class EventHandlerBase {
        constructor() {
            this._listeners = new Map() // string type -> [listener, ...]
        }

        addEventListener(type, listener) {
            let listeners = this._listeners.get(type)
            if (Array.isArray(listeners) === false) {
                listeners = []
                this._listeners.set(type, listeners)
            }
            listeners.push(listener)
        }

        removeEventListener(type, listener) {
            let listeners = this._listeners.get(type)
            if (Array.isArray(listeners) === false) {
                return
            }
            for (let i = 0; i < listeners.length; i++) {
                if (listeners[i] === listener) {
                    listeners.splice(i, 1)
                    return
                }
            }
        }

        dispatchEvent(event) {
            let listeners = this._listeners.get(event.type)
            if (Array.isArray(listeners) === false) return

            // need a copy, since removeEventListener is often called inside listeners to create one-shots and it modifies the array, causing
            // listeners not to be called!
            var array = listeners.slice(0);
            for (let listener of array) {
                listener(event)
            }
        }
    }


    class ARController/* extends EventHandlerBase */ {
        constructor(domElement, shouldStartPresenting = true, useComputerVision = false, baseController) {
            // super();
            this.el = domElement;
            this.shouldStartPresenting = shouldStartPresenting;//开始展示标志位
            this.useComputerVision = useComputerVision;//使用计算机视觉标志位

            this.XR = null;
            this.frameOfRef = null;

            //应用于WebRTC获取视频流的形式
            this.videoEl = null;

            // 检测到xr时使用
            this.device = null;
            this.session = null;

            this.baseController = baseController;//设置不支持XR时使用何种基础控制方式

            //用于设置requestAnimationFrame的回调函数
            this._boundHandleFrame = this._handleFrame.bind(this);

            this.threeJSController = new ThreeJSController();//3D场景控制器


            // 该场景使用头部姿态绕相机旋转
            this.scene = new THREE.Scene() // The scene will be rotated and oriented around the camera using the head pose

            //会被ARCore或ARKit中的投影矩阵重写
            this.camera = new THREE.PerspectiveCamera(70, 1024, 1024, 0.1, 1000) // These values will be overwritten by the projection matrix from ARKit or ARCore
            this.scene.add(this.camera)

            // 为会话层创建一个canvas和context
            this.glCanvas = document.createElement('canvas')
            this.glContext = this.glCanvas.getContext('webgl')
            if (this.glContext === null) {
                this.showMessage('Could not create a WebGL canvas')
                throw new Error('Could not create GL context')
            }

            // 使用会话层的上下文设置THREE的renderer
            // Set up the THREE renderer with the session's layer's glContext
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.glCanvas,
                context: this.glContext,
                antialias: false,
                alpha: true
            });

            this.renderer.setPixelRatio(1);
            this.renderer.autoClear = false;
            this.renderer.setClearColor('#000', 0);

            // 该组最终被定位到地板
            this.requestedFloor = false;
            this.floorGroup = new THREE.Group();

            // 将在_handleFrame中使用的一组信息，以使用锚点更新节点
            this.anchoredNodes = []; // { XRAnchorOffset, Three.js Object3D }

            // 为扩展类提供初始化场景
            this.initializeScene();

            // 检测是否支持XR
            if (navigator.xr) {
                this.XR = navigator.xr;
                if (XRSession.prototype.requestHitTest) {
                    this.hitTest = XRSession.prototype.requestHitTest;
                }

                navigator.xr.requestDevice()
                    .then(device => {
                        this.device = device;
                        this._requestARSession();
                    })
                    .catch(e => {
                        this.showMessage('The Device do not support XR')
                    });
            } else {
                this.showMessage('非XR浏览器');
            }
        }

        //击中测试方法
        hitTest() {

        }

        _requestDevice() {
            // 检测是否支持WebXR
            if (navigator.xr) {
                this.XR = navigator.xr;
                this.hitTest = XRSession.prototype.requestHitTest;
                this.XR.requestDevice().then(device => {
                    this.device = device;
                });
            }
        }

        // 请求Session
        _requestARSession(device) {
            const outputCanvas = document.createElement('canvas');
            const xrctx = outputCanvas.getContext('xrpresent');

            if (this.device) {

                //检测是否支持请求的会话类型
                this.device.requestSession({
                    outputContext: xrctx,
                    environmentIntegration: true
                }).then(function (session) {
                    console.log(session)
                    this._handleSessionStart(session)
                }).catch(e => {
                    console.log('request ARSession failed')
                })

            } else {
                // this.showMessage('Deivce does not support ARSession');
                console.log('Deivce is null');
            }

            document.body.appendChild(outputCanvas);

        }

        // 获取Session后
        _handleSessionStart(session) {
            this.session = session;
            this.session.depthNear = 0.1;
            this.session.depthFar = 1000.0;

            this.session.addEventListener('focus', ev => {
                this.handleSessionFocus(ev)
            });
            this.session.addEventListener('blur', ev => {
                this.handleSessionBlur(ev)
            });
            this.session.addEventListener('end', ev => {
                this.handleSessionEnded(ev)
            });


            this.session.requestFrameOfReference('eye-level').then(frameOfRef => {
                debugger
                this.frameOfRef = frameOfRef;
                //开始循环渲染
                if (this.shouldStartPresenting) {
                    this.startPresenting();
                }
                // this.session.requestAnimationFrame(this._boundHandleFrame);
            }).catch(e => {
                console.log('requestFrameOfReference failed')
            });
        }


        /*
        扩展该类重写类的构造方法中设置的scene
        */
        initializeScene() {
        }

        updateScene(frame) {

        }

        // 用于requestAnimationFrame的更新回调
        _handleFrame(time, frame) {
            debugger
            console.log(this.frameOfRef)
            // 设置更新Frame
            this.session.requestAnimationFrame(this._boundHandleFrame)

            //获取设备姿态
            const pose = frame.getDevicePose(this.frameOfRef);

            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.session.baseLayer.framebuffer);

            //若要执行击中检测
            if (this.hitTest) {

            }
            if (pose) {
                // 在每次渲染签使用扩展的类更新场景
                // Let the extending class update the scene before each render
                this.updateScene(frame)

                // Prep THREE.js for the render of each XRView
                this.renderer.autoClear = false
                this.renderer.setSize(this.session.baseLayer.framebufferWidth, this.session.baseLayer.framebufferHeight, false)
                this.renderer.clear();

                this.camera.matrixAutoUpdate = false

                for (let view of frame.views) {//在WebXR标准中，应该是XRViewerPose.views
                    //获取视点
                    const viewport = session.baseLayer.getViewport(view);
                    this.renderer.setSize(viewport.width, viewport.height);

                    // 通过XRDevicePose获取的视图矩阵和通过XRView获取的投影矩阵，更新three.js中的相机的姿态
                    //这同步（虚拟相机的位置和方向）与（设备的估计物理位置和方向）。
                    this.camera.projectionMatrix.fromArray(view.projectionMatrix);
                    const viewMatrix = new THREE.Matrix4().fromArray(pose.getViewMatrix(view));
                    this.camera.matrix.getInverse(viewMatrix);
                    this.camera.updateMatrixWorld(true);

                    //渲染器渲染场景与虚拟相机。
                    // Render our scene with our THREE.WebGLRenderer
                    this.renderer.render(this.scene, this.camera);
                }
            }
        }

        // 开始渲染
        startPresenting() {
            // session不存在的情况
            if (this.session === null) {
                this.showMessage('Can not start presenting without a session')
                console.log('Can not start presenting without a session')
                return;
            }

            // Set the session's base layer into which the app will render
            this.session.baseLayer = new XRWebGLLayer(this.session, this.glContext)

            // Handle layer focus events
            this.session.baseLayer.addEventListener('focus', ev => {
                this.handleLayerFocus(ev)
            });
            this.session.baseLayer.addEventListener('blur', ev => {
                this.handleLayerBlur(ev)
            });

            this.session.requestAnimationFrame(this._boundHandleFrame)
        }

        // 自定义session的各种状态的响应
        // Extending classes can react to these events
        handleSessionFocus(ev) {
        }

        handleSessionBlur(ev) {
        }

        handleSessionEnded(ev) {
        }

        handleLayerFocus(ev) {
        }

        handleLayerBlur(ev) {
        }

        showMessage(messageText) {
            let messages = document.getElementsByClassName('common-message')
            if (messages.length > 0) {
                var message = messages[0]
            } else {
                var message = document.createElement('div')
                message.setAttribute('class', 'common-message')
                this.el.append(message)
            }
            let div = document.createElement('div')
            div.innerHTML = messageText
            message.appendChild(div)
        }

    }

    class ARSea extends ARController {
        constructor(domEl) {
            super(domEl, false);
        }

        initializeScene() {
            console.log('init subclass')
            this.scene = createCubeScene();
        }
    }


    return {
        ThreeJSController: ThreeJSController,
        ImageController: ImageController,
        OrbitController: OrbitController,
        RealWorldController: RealWorldController,
        OrientationController: OrientationController,
        ImageOrbitController: ImageOrbitController,
        ImageOrientationController: ImageOrientationController,
        XRHitController: XRHitController,
        openCamera: openCamera,
        createCube: createCube,
        recognitionCenter: recognitionCenter,
        XRDetect: XRDetect,
        ARController: ARController,
        ARSea: ARSea,
        // XRControllerBase: XRControllerBase,
        // ARSimplestExample: ARSimplestExample,
    }
});


