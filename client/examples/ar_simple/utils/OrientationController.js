define(function () {
    /**
     * 方向传感器控制，操控的是three.js中模型的位置
     */
    class OrientationController {
        constructor(renderer, scene, camera, model, modelSize) {
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
            this.onFrame = this.onFrame.bind(this);
            this.init();
        }

        init() {
            let _self = this;
            if (this.model) {
                this.scene.add(this.model);
            }
            window.addEventListener('deviceorientation', function (event) {
                //重力感应事件处理
                var alpha = event.alpha / 180 * Math.PI;
                var beta = event.beta / 180 * Math.PI;
                var gamma = event.gamma / 180 * Math.PI;
                if (_self.model) {
                    //控制模型位置
                    //反转
                    let matrix = _self.model.matrix.clone();
                    matrix.getInverse(matrix);
                    _self.model.applyMatrix(matrix);


                    //欧拉角顺序应该为ZXY，另外需要注意的是前边参数的顺序和后边设置的顺序不是一一对应的，也就是说就算顺序被设置为ZXY，前边三个参数的顺序依然XYZ
                    let euler = new THREE.Euler();
                    euler.set(beta, gamma, alpha, 'ZXY');
                    _self.model.setRotationFromEuler(euler);
                    // _self.onFrame();
                } else {
                    // 控制的是相机
                    //反转
                    let matrix = _self.camera.matrix.clone();
                    matrix.getInverse(matrix);
                    _self.camera.applyMatrix(matrix);


                    //欧拉角顺序应该为ZXY，另外需要注意的是前边参数的顺序和后边设置的顺序不是一一对应的，也就是说就算顺序被设置为ZXY，前边三个参数的顺序依然XYZ
                    let euler = new THREE.Euler();
                    euler.set(beta, gamma, alpha, 'ZXY');
                    _self.camera.setRotationFromEuler(euler);
                    // _self.onFrame();

                }
            }, false);
        }

        onFrame() {
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(this.onFrame);

        }
    }

    return OrientationController;
});