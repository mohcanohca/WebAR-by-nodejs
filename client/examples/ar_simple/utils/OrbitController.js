require.config({
    baseUrl: '/examples/ar_simple',
    paths: {
        orbitControl: 'libs/OrbitControls',
    }
});
define(['orbitControl'], function (orbitController) {
    class OrbitController {
        constructor({renderer, scene, camera, model, modelSize}) {
            //three.js
            this.renderer = renderer;
            this.scene = scene;
            // this.camera = new THREE.PerspectiveCamera(45,window.innerWidth / window.innerHeight,1,1000);
            //创建camera后再修改器焦距等参数是无法生效的
            this.camera = camera;
            this.camera.matrixAutoUpdate = true;
            this.camera.fov = 40;
            this.camera.near = 1;
            this.camera.far = 1000;
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.up.x = 0;
            this.camera.up.y = 1;
            this.camera.up.z = 0;
            this.camera.position.x = 0;
            this.camera.position.y = 0;
            this.camera.position.z = 10;
            this.camera.lookAt(this.scene.position);

            this.model = model;
            this.modelSize = modelSize;

            this.stopFrame = null;
            this.onFrame = this.onFrame.bind(this);
            this.init();
        }

        init() {
            let controller = new orbitController(this.camera, this.renderer.domElement);
            if (this.model) {
                this.scene.add(this.model)
            }
        }

        onFrame() {
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            this.stopFrame = requestAnimationFrame(this.onFrame);
        }
    }

    return OrbitController;
});