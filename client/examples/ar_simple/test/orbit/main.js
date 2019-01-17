require.config({
    paths: {
        ARController: '../../utils/ARController'
    }
});

define(['ARController'], function (ARControllerBase) {

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


    class OrbitExample extends ARControllerBase {
        /*        constructor() {
                    super(true, ARControllerBase.ORBITCONTROLLER)
                }

                initScene() {
                    this.scene = new THREE.Scene();
                    this.model = createCube(2, 2, 2);
                    this.model.position.set(0, 0, 0);
                    this.model.position.multiplyScalar(1);
                    this.modelSize = 2;
                }*/

        constructor() {
            super(true, ARControllerBase.ORBITCONTROLLER)
        }

        initScene() {
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
    // window.app = new OrientationExample();//orientation控制模型
    // window.app = new OrientationCubeSea();//orientation控制相机
    window.app = new OrbitExample();
    // window.app = new GPSExample();

})


