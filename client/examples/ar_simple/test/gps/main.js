require.config({
    paths: {
        ARController: '../../utils/ARController'
    }
});

define(['ARController'], function (ARControllerBase) {

    class GPSExample extends ARControllerBase {
        constructor() {
            super({useReticle: false, useSelect: false, baseControlType: ARControllerBase.GPSCONTROLLER})
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
            this.scene = new THREE.Scene();
            let texture = new THREE.TextureLoader().load('./assets/snow-32.png');

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
    // window.app = new OrientationExample();//orientation控制模型
    // window.app = new OrientationCubeSea();//orientation控制相机
    // window.app = new OrbitExample();
    window.app = new GPSExample();

})


