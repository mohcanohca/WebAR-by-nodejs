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

    class EarthExample extends ARControllerBase {
        constructor() {
            // super(true, false, ARControllerBase.IMAGECONTROLLER, {method: 'front', patternImg: 'pattern'});
            super({
                useReticle: false,
                useSelect: false,
                baseControlType: ARControllerBase.IMAGECONTROLLER,
                baseControlParam: {method: 'front', patternImg: 'pattern'}
            });
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


    window.app = new EarthExample();//图像识别控制
})


