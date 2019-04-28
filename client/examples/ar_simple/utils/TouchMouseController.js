require.config({
    baseUrl: '/examples/ar_simple/',
    paths: {
        // orbitControls: 'libs/OrbitControls',
        DragControls: 'libs/DragControls',
        TrackballControls: 'libs/TrackballControls',
    },
    shim: {
        // 'OrbitControls': {exports: 'THREE.OrbitControls'},
        'DragControls': {exports: 'THREE.DragControls'},
        'TrackballControls': {exports: 'THREE.TrackballControls'},
        // 'TransformControls': {exports: 'THREE.TransformControls'},
    }
});
define([/*'OrbitControls', */'DragControls', 'TrackballControls'/*, 'TransformControls'*/], function (/*OrbitControls, */DragControls, TrackballControls, /* TransformControls*/) {
    class TouchMouseController {
        constructor({renderer, scene, camera, model, modelState}) {
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
            this.camera.position.x = 0;
            this.camera.position.y = 400;
            this.camera.position.z = 600;
            this.camera.lookAt(new THREE.Vector3(0, 0, 0));

            this.model = model;
            this.modelState = modelState;

            this.stopFrame = null;
            this.onFrame = this.onFrame.bind(this);
            this.init();
        }

        init() {
            if (this.model) {
                this.scene.add(this.model);
                let scale_size = this.modelState.scale_size;

                this.model.scale.set(scale_size, scale_size, scale_size);
            }

            this.initControls();
            this.initDragControls()
        }

        initControls() {
            this.controls = new THREE.TrackballControls(this.camera, this.renderer.domElement);
            // this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        }

        // 添加拖拽控件
        initDragControls() {

            let scene = this.scene;
            let renderer = this.renderer;
            let camera = this.camera;

            let _self = this;
            // 添加平移控件
            // var transformControls = new THREE.TransformControls(camera, renderer.domElement);
            // scene.add(transformControls);

            // 过滤不是 Mesh 的物体,例如辅助网格对象
            let objects = [];
            for (let i = 0; i < scene.children.length; i++) {
                let child = scene.children[i];
                if (child.isMesh && child.dragable !== false) {
                    objects.push(scene.children[i]);
                }
            }

            // 初始化拖拽控件
            let dragControls = new THREE.DragControls(objects, camera, renderer.domElement);

            /*// 鼠标略过
            dragControls.addEventListener('hoveron', function (event) {
                // debugger
                transformControls.attach(event.object);
            });*/

            // 开始拖拽
            dragControls.addEventListener('dragstart', function (event) {
                // debugger
                _self.controls.enabled = false;
            });
            // 拖拽结束
            dragControls.addEventListener('dragend', function (event) {
                _self.controls.enabled = true;
            });
        }


        onFrame() {
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            this.controls.update();
            this.stopFrame = requestAnimationFrame(this.onFrame);
        }
    }

    return TouchMouseController;
});