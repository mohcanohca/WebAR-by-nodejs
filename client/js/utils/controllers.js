define(function () {
    let defaultWidth = window.innerWidth;
    let defaultHeight = window.innerHeight;

    class ThreeJSController {
        constructor() {
            this.renderer = null;
            this.camera = null;
            this.scene = null;
            this.model = null;
            this.init = this.init.bind(this);
            this.addModel = this.addModel.bind(this);
            this.updateThreeCamera = this.updateThreeCamera.bind(this);
            this.render = this.render.bind(this);
        }

        //初始化Three.js的必要组件
        init() {
            this.renderer = new THREE.WebGLRenderer();
            this.renderer.setSize(defaultWidth, defaultHeight);
            this.renderer.setClearColor(0xffffff, 1);
            this.camera = new THREE.PerspectiveCamera();
            this.camera.matrixAutoUpdate = false;
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
            this.model.scale.x = modelSize;
            this.model.scale.y = modelSize;
            this.model.scale.z = modelSize;

            this.model.rotation.x = -Math.asin(-rotation[1][2]);
            this.model.rotation.y = -Math.atan2(rotation[0][2], rotation[2][2]);
            this.model.rotation.z = Math.atan2(rotation[1][0], rotation[1][1]);

            this.model.position.x = translation[0];
            this.model.position.y = translation[1];
            this.model.position.z = -translation[2];
        }

        updateThreeCamera(pose) {
            if (pose.viewMatrix) {
                // 将camera的matrix与viewMatrix的逆矩阵相乘
                this.camera.matrix.getInverse(viewMatrix);
                //更新世界矩阵。如果父对象发生了形变，那么他的形变需要传递到下面所有的子对象 。
                this.camera.updateMatrixWorld(true);
            }
            if (pose.projectionMatrix) {
                this.camera.projectionMatrix.fromArray(projectionMatrix);
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
            // this.init = this.init.bind(this);
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
            this.createModel = this.createModel.bind(this);
            this.locateModel = this.locateModel.bind(this);
        }

        init() {
            //创建输出上下文
            let canvas = document.createElement('canvas');
            canvas.width = defaultWidth;
            canvas.height = defaultHeight;
            this.outputCanvas = canvas;
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
            if (!this.model) {
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


/*        render(renderer, scene, camera) {
            let _renderer = renderer || this.renderer;
            let _scene = scene || this.scene;
            let _camera = camera || this.camera;

            if (!_renderer) return;
            // _renderer.autoClear = false;
            // _renderer.clear();
            _renderer.render(_scene, _camera);
        }*/

    }


    return {
        ThreeJSController: ThreeJSController,
        ImageController: ImageController,
        RealWorldController: RealWorldController,
    }
});


