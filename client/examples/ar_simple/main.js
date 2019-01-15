require.config({
    paths: {
        ARController: './utils/ARController'
    }
});

define(['ARController'], function (ARControllerBase) {

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

    // 创建一个包含光源的场景
    function createLitScene() {
        const scene = new THREE.Scene();

        // The materials will render as a black mesh
        // without lights in our scenes. Let's add an ambient light
        // so our material can be visible, as well as a directional light
        // for the shadow.
        const light = new THREE.AmbientLight(0xffffff, 1);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
        directionalLight.position.set(10, 15, 10);

        // We want this light to cast shadow.
        directionalLight.castShadow = true;

        // Make a large plane to receive our shadows
        const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
        // Rotate our plane to be parallel to the floor
        planeGeometry.rotateX(-Math.PI / 2);

        // Create a mesh with a shadow material, resulting in a mesh
        // that only renders shadows once we flip the `receiveShadow` property.
        const shadowMesh = new THREE.Mesh(planeGeometry, new THREE.ShadowMaterial({
            color: 0x111111,
            opacity: 0.2,
        }));

        // Give it a name so we can reference it later, and set `receiveShadow`
        // to true so that it can render our model's shadow.
        shadowMesh.name = 'shadowMesh';
        shadowMesh.receiveShadow = true;
        shadowMesh.position.y = 10000;

        // Add lights and shadow material to scene.
        scene.add(shadowMesh);
        scene.add(light);
        scene.add(directionalLight);

        return scene;
    }

    // 创建一个正方体
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

    const opacityRemap = mat => {
        if (mat.opacity === 0) {
            mat.opacity = 1;
        }
    };

    // 加载模型
    function loadModel(objURL, mtlURL) {
        // OBJLoader and MTLLoader are not a part of three.js core, and
        // must be included as separate scripts.
        const objLoader = new THREE.OBJLoader();
        const mtlLoader = new THREE.MTLLoader();

        // Set texture path so that the loader knows where to find
        // linked resources
        mtlLoader.setTexturePath(mtlURL.substr(0, mtlURL.lastIndexOf('/') + 1));

        // remaps ka, kd, & ks values of 0,0,0 -> 1,1,1, models from
        // Poly benefit due to how they were encoded.
        mtlLoader.setMaterialOptions({ignoreZeroRGBs: true});

        // OBJLoader and MTLLoader provide callback interfaces; let's
        // return a Promise and resolve or reject based off of the asset
        // downloading.
        return new Promise((resolve, reject) => {
            mtlLoader.load(mtlURL, materialCreator => {
                // We have our material package parsed from the .mtl file.
                // Be sure to preload it.
                materialCreator.preload();

                // Remap opacity values in the material to 1 if they're set as
                // 0; this is another peculiarity of Poly models and some
                // MTL materials.
                for (let material of Object.values(materialCreator.materials)) {
                    opacityRemap(material);
                }

                // Give our OBJ loader our materials to apply it properly to the model
                objLoader.setMaterials(materialCreator);

                // Finally load our OBJ, and resolve the promise once found.
                objLoader.load(objURL, resolve, function () {
                }, reject);
            }, function () {
            }, reject);
        });
    }


    class ARSea extends ARControllerBase {
        constructor() {
            super(/*ARControllerBase.IMAGECONTROLLER*/);
        }

        initScene() {
            console.log('init arsea')
            this.scene = createCubeScene();
        }
    }

    class ModelExample extends ARControllerBase {
        constructor() {
            super(true)
        }

        initScene() {
            console.log('createLitScene');
            this.scene = createLitScene();
            const MODEL_OBJ_URL = './assets/ArcticFox_Posed.obj';
            const MODEL_MTL_URL = './assets/ArcticFox_Posed.mtl';
            const MODEL_SCALE = 0.1;
            loadModel(MODEL_OBJ_URL, MODEL_MTL_URL).then(model => {
                this.model = model;
                this.modelSize = MODEL_SCALE;
                // Every model is different -- you may have to adjust the scale
                // of a model depending on the use.
                this.model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
            });
        }
    }

    class EarthExample extends ARControllerBase {
        constructor() {
            super(true, ARControllerBase.IMAGECONTROLLER, /* {method: 'front'}*/);
        }

        initScene() {
            this.scene = createLitScene();
            let object = new THREE.Object3D(),
                geometry = new THREE.SphereGeometry(0.5, 15, 15, Math.PI),
                loader = new THREE.TextureLoader();
            loader.load("./assets/earth.jpg", function (texture) {
                let material = new THREE.MeshBasicMaterial({map: texture});
                let mesh = new THREE.Mesh(geometry, material);
                object.add(mesh);
            });
            //场景添加模型，实际添加以地图图像为贴图的球体
            this.model = object;
            this.modelSize = 35;
            // this.scene.add(this.model);
        }

    }

    class OrientationExample extends ARControllerBase {
        constructor() {
            super(true, ARControllerBase.ORIENTATIONCONTROLLER);
        }

        initScene() {
            this.scene = new THREE.Scene();
            this.model = createCube(2, 2, 2);
            this.model.position.set(0, 0, 0);
            this.model.position.multiplyScalar(1);
            this.modelSize = 2;
            // this.scene.add(this.model);
        }
    }

    class OrientationCubeSea extends ARControllerBase {
        constructor() {
            super(true, ARControllerBase.ORIENTATIONCONTROLLER);
        }

        initScene() {
            this.scene = createCubeScene()
        }
    }

    class OrbitExample extends ARControllerBase {
        constructor() {
            super(true, ARControllerBase.ORBITCONTROLLER)
        }

        initScene() {
            this.scene = new THREE.Scene();
            this.model = createCube(2, 2, 2);
            this.model.position.set(0, 0, 0);
            this.model.position.multiplyScalar(1);
            this.modelSize = 10;
            // this.scene.add(this.model);
        }
    }

    class GPSExample extends ARControllerBase {
        constructor() {
            super(true, ARControllerBase.GPSCONTROLLER)
        }

        initScene() {
            this.scene = new THREE.Scene();
            let texture = new THREE.TextureLoader().load('../../js/textures/snow-32.png');

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

                let points = new THREE.Points(geometry, pointsMaterial);
                points.position.y = -30;

                return points;
            }

            this.model = initWeatherContent(texture);
        }
    }


    document.body.innerHTML = document.body.innerHTML + `<div id="enter-ar-info" class="demo-card mdl-card mdl-shadow--4dp">
    <div class="mdl-card__title">
        <h2 class="mdl-card__title-text">Augmented Reality with the WebXR Device API</h2>
    </div>
    <div class="mdl-card__supporting-text">
        This is an experiment using augmented reality features with the WebXR Device API.
        Upon entering AR, you will be surrounded by a world of cubes.
        Learn more about these features from the <a href="https://codelabs.developers.google.com/codelabs/ar-with-webxr">Building an augmented reality application with the WebXR Device API</a> Code Lab.
    </div>
    <div class="mdl-card__actions mdl-card--border">
        <a id="enter-ar" class="mdl-button mdl-button--raised mdl-button--accent">
            Start augmented reality
        </a>
    </div>
</div>
<div id="unsupported-info" class="demo-card mdl-card mdl-shadow--4dp">
    <div class="mdl-card__title">
        <h2 class="mdl-card__title-text">Unsupported Browser</h2>
    </div>
    <div class="mdl-card__supporting-text">
        Your browser does not support AR features with WebXR. Learn more about these features from the <a href="https://codelabs.developers.google.com/codelabs/ar-with-webxr">Building an augmented reality application with the WebXR Device API</a> Code Lab.
    </div>
</div>
`

    // window.app = new ARSea();
    // window.app = new ModelExample();
    // window.app = new EarthExample();//图像识别控制
    window.app = new OrientationExample();//orientation控制模型
    // window.app = new OrientationCubeSea();//orientation控制相机
    // window.app = new OrbitExample();
    // window.app = new GPSExample();

})


