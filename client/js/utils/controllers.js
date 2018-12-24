require.config({
    paths: {
        orbitController: '../utils/OrbitControls',
        eventManager: '../utils/event',
        mediaDevices: '../utils/webrtc',
    }
});
define(['orbitController', 'eventManager', 'mediaDevices'], function (orbitController, eventManager, mediaDevices) {
    let defaultWidth = window.innerWidth;
    let defaultHeight = window.innerHeight;
    let video;

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
        let cameraDeviceIds = []
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
            this.init = this.init.bind(this);
            this.addModel = this.addModel.bind(this);
            this.updateCamera = this.updateCamera.bind(this);
            this.updateModelPosition = this.updateModelPosition.bind(this);
            this.render = this.render.bind(this);
        }

        //初始化Three.js的必要组件
        init() {
            this.renderer = new THREE.WebGLRenderer();
            this.renderer.setSize(defaultWidth, defaultHeight);
            this.renderer.setClearColor(0xffffff, 1);
            this.camera = new THREE.PerspectiveCamera();
            // this.camera.matrixAutoUpdate = false;
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

        setThreeCameraProps(props) {
            for (let i in props) {
                this.camera[i] = props[i];
            }
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
                alert('Controller is not inited');
                return;
            }

            _renderer.render(_scene, _camera);
        }
    }

    class Controller {
        constructor() {
            this.outputCanvas = null;
            this.threeController = new ThreeJSController();
        }

        init() {
            //创建输出上下文
            let canvas = document.createElement('canvas');
            canvas.width = defaultWidth;
            canvas.height = defaultHeight;
            this.outputCanvas = canvas;
        }
    }

    class ImageController extends Controller {
        constructor() {
            super();
            this.model = null;
            this.posit = null;
            this.threeController = new ThreeJSController();
            this.init = this.init.bind(this);
            this.createModel = this.createModel.bind(this);
            this.locateModel = this.locateModel.bind(this);
        }

        init() {
            //创建输出上下文
            let canvas = document.createElement('canvas');
            canvas.width = defaultWidth;
            canvas.height = defaultHeight;
            this.outputCanvas = canvas;

            let threeController = this.threeController;
            threeController.init();
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

        control(callback,updateCB) {
            let _self = this;
            let realWorldController = new RealWorldController();
            let threeController = this.threeController;
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
                    window.addEventListener('resize', function () {
                        onWindowResize.call(_self);
                    }, false);

                    animate();

                    callback(video);
                }
            });
            openCamera();

            function animate(update) {
                requestAnimationFrame(animate);
                //更新渲染的现实世界场景
                realWorldController.update();
                updateCB();
                //放置两个场景
                threeController.renderer.autoClear = false;
                threeController.renderer.clear();

                realWorldController.render(threeController.renderer);
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

    class RealWorldController extends ThreeJSController {
        constructor() {
            super();
            this.model = null;
            this.init = this.init.bind(this);
            this.update = this.update.bind(this);
            this.createTexture = this.createTexture.bind(this);
            this.render = this.render.bind(this);
        }

        //初始化环境组件
        init(material) {
            this.renderer = new THREE.WebGLRenderer();
            this.renderer.setSize(defaultWidth, defaultHeight);
            this.renderer.setClearColor(0xffffff, 1);
            this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5);
            this.scene = new THREE.Scene();
            this.scene.add(this.camera);

            this.model = this.createTexture(material);
            this.scene.add(this.model);
        }

        //更新渲染内容
        update() {
            this.model.children[0].material.map.needsUpdate = true;
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

    class OrbitController extends ThreeJSController {
        constructor() {
            super();
            this.model = null;
            this.posit = null;
            this.threeController = new ThreeJSController();
            this.orbitControls = null;

        }

        init(model) {
            let threeController = this.threeController;
            threeController.init();
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

            if (!model) {
                //添加模型
                threeController.addModel(createCube(10, 10, 10));
            } else {
                threeController.addModel(model);
            }
            threeController.updateModelPosition({x: 0, y: 0, z: -100});
        }

        control() {
            this.orbitControls = new orbitController(this.threeController.camera, this.threeController.renderer.domElement)
        }
    }


    class OrientationController extends Controller {
        constructor() {
            super();
            this.threeController = new ThreeJSController();
        }

        init(model) {
            let threeController = this.threeController;
            threeController.init();
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
            threeController.updateCamera({position: {x: 0, y: 0, z: 100}});
            camera.lookAt(scene.position);

            if (!model) {
                //添加模型
                threeController.addModel(createCube(10, 10, 10));
            } else {
                threeController.addModel(model);
            }
        }

        control() {
            let model = this.threeController.model;
            window.addEventListener('deviceorientation', function (event) {
                //重力感应事件处理
                var alpha = event.alpha / 180 * Math.PI;
                var beta = event.beta / 180 * Math.PI;
                var gamma = event.gamma / 180 * Math.PI;

                //反转
                var matrix = model.matrix.clone();
                matrix.getInverse(matrix);
                model.applyMatrix(matrix);


                //欧拉角顺序应该为ZXY，另外需要注意的是前边参数的顺序和后边设置的顺序不是一一对应的，也就是说就算顺序被设置为ZXY，前边三个参数的顺序依然XYZ
                var euler = new THREE.Euler();
                euler.set(beta, gamma, alpha, 'ZXY');
                model.setRotationFromEuler(euler);
            }, false);
        }

    }

    class ImageOrbitController extends ImageController {
        constructor() {
            super();
        }

        init(model) {
            super.init.call(this);
            let threeController = this.threeController;
            threeController.init();

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

        control(response) {
            let threeController = this.threeController;
            document.addEventListener('mouseup', handler, false);

            function handler() {
                threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
                threeController.camera.lookAt(threeController.scene.position);
                document.removeEventListener('mouseup', handler, false);
                response()
            }

            this.orbitControls = new orbitController(this.threeController.camera, this.threeController.renderer.domElement)
        }
    }


    class ImageOrientationController extends ImageController {
        constructor() {
            super();
        }

        init(model) {
            super.init.call(this);
            let threeController = this.threeController;
            threeController.init();
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

        control() {
            let model = this.threeController.model;
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
                this.threeController.updateModel(modelSize, null, pose.bestTranslation);
            }
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
    }
});


