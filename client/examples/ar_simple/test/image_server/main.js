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

    class HitTest extends ARControllerBase {
        constructor() {
            /*            super(true, false, ARControllerBase.IMAGECONTROLLER, {
                            method: 'server',
                            serverPath: 'https://10.28.161.133:8081',
                            protocol: 'ws',
                        });*/
            super({
                useReticle: true,
                useSelect: false,
                baseControlType: ARControllerBase.IMAGECONTROLLER,
                baseControlParam: {
                    method: 'server',
                    serverPath: 'https://192.168.0.116:8081',
                    protocol: 'ws',
                }
            });
        }

        setAREntrance(callback) {
            document.querySelector('#enter-ar').addEventListener('click', callback, false);
        }

        addListeners() {
            this.addEventListener(ARControllerBase.SESSIONSTART, function () {
                // 将页面样式切换至ar会话状态
                document.body.classList.add('ar');
            });
        }

        initScene() {
            this.scene = createLitScene();
        }

        initModel() {
            /* let object = new THREE.Object3D(),
                 geometry = new THREE.SphereGeometry(0.5, 15, 15, Math.PI),
                 loader = new THREE.TextureLoader();
             loader.load("./assets/earth.jpg", function (texture) {
                 let material = new THREE.MeshBasicMaterial({map: texture});
                 let mesh = new THREE.Mesh(geometry, material);
                 object.add(mesh);
             });
             //场景添加模型，实际添加以地图图像为贴图的球体
             this.model = object;
             this.modelSize = 35;*/

            const MODEL_OBJ_URL = './assets/ArcticFox_Posed.obj';
            const MODEL_MTL_URL = './assets/ArcticFox_Posed.mtl';
            const MODEL_SCALE = 1;
            loadModel(MODEL_OBJ_URL, MODEL_MTL_URL).then(model => {
                this.model = model;
                this.modelSize = MODEL_SCALE;
                // Every model is different -- you may have to adjust the scale
                // of a model depending on the use.
                this.model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
            });
        }

    }


    window.app = new HitTest();//图像识别控制
})


