require.config({
    paths: {
        ARController: '../../utils/ARController'
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

    /**
     * Similar to THREE.Object3D's `lookAt` function, except we only
     * want to rotate on the Y axis. In our AR use case, we don't want
     * our model rotating in all axes, instead just on the Y.
     * 类似于THREE.js中3D物体的lookAt方法，但是在此处仅仅旋转Y轴。
     *
     * @param {THREE.Object3D} looker
     * @param {THREE.Object3D} target
     */
    function lookAtOnY(looker, target) {
        //matrixWorld表示物体的全局形变，表示物体在场景中的位置，通过local matrix（object.matrix）与父亲的matrixWorld递归相乘得到的
        // setFromMatrixPosition(matrix)将matrix转换成向量
        const targetPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);

        const angle = Math.atan2(targetPos.x - looker.position.x,
            targetPos.z - looker.position.z);

        looker.rotation.set(0, angle, 0);
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

    //随机生成颜色
    function randomColor() {
        var arrHex = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"],
            strHex = "#",
            index;
        for (var i = 0; i < 6; i++) {
            index = Math.round(Math.random() * 15);
            strHex += arrHex[index];
        }
        return strHex;
    }


    /**
     * 创建一堆立方体
     * @param scene
     */
    function initModel(scene) {

        var s = 15;

        var cube = new THREE.CubeGeometry(s, s, s);

        for (var i = 0; i < 30; i++) {

            var material = new THREE.MeshBasicMaterial({color: randomColor()});

            var mesh = new THREE.Mesh(cube, material);

            mesh.position.x = 100 * (2.0 * Math.random() - 1.0);
            mesh.position.y = 100 * (2.0 * Math.random() - 1.0);
            mesh.position.z = 100 * (2.0 * Math.random() - 1.0);

            mesh.rotation.x = Math.random() * Math.PI;
            mesh.rotation.y = Math.random() * Math.PI;
            mesh.rotation.z = Math.random() * Math.PI;

            mesh.updateMatrix();

            scene.add(mesh);

        }

    }


    class SelectTest extends ARControllerBase {
        constructor() {
            // super(false, true, ARControllerBase.ORIENTATIONCONTROLLER)
            super({
                useReticle: false,
                useSelect: true,
                baseControlType: ARControllerBase.ORIENTATIONCONTROLLER,
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

        // 自定义虚拟场景
        initScene() {
            this.scene = new THREE.Scene();
            initModel(this.scene);
            //this.model = createCube(1, 1, 1);
            // this.modelSize = 10;
        }

        /**
         * 覆写父类的handleSelect
         *
         * @param intersects
         *
         * 参数有两种形式:
         * 如果没有开启平面检测，返回的是用户点击击中的结果
         intersects: Array(1)
         0:
         distance: 112.34699914175158
         face: Face3 {a: 6, b: 7, c: 5, normal: Vector3, vertexNormals: Array(3), …}
         faceIndex: 3
         object: Mesh {uuid: "7CCB8016-5443-455C-9CC7-7CE4354DEE22", name: "", type: "Mesh", parent: Scene, children: Array(0), …}
         point: Vector3 {x: -58.42976549707005, y: -79.54935982006027, z: 59.481317630543344}
         uv: Vector2 {x: 0.7698655719706486, y: 0.09801301808355674}
         __proto__: Object
         length: 1
         __proto__: Array(0)

         若是开启平面检测，返回的是hittest的结果
         intersects: Array(1)
         0: XRHitResult
         hitMatrix: Float32Array(16) [0.7732632160186768, 0, -0.6340852379798889, 0, 0, 1, 0, 0, 0.6340852379798889, 0, 0.7732632160186768, 0, 1.7730376720428467, -0.5927649736404419, -0.5793924927711487, 1]
         __proto__: XRHitResult

         *
         *
         *
         *
         */
        handleSelect(intersects) {

            if (intersects.length) {
                // We can have multiple collisions per hit test. Let's just take the
                // first hit, the nearest, for now.
                const hit = intersects[0];


                // 如果是非XRSession模式，获取到的是击中物体
                if (!hit.hitMatrix) {
                    for (let i = 0; i < intersects.length; i++) {
                        intersects[i].object.material.color.set(0xff0000);
                    }
                    return;
                }

                const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);

                // If our model is not yet loaded, abort
                if (!this.model) {
                    return;
                }

                // 缩放模型大小使其能被观察到全貌
                if (this.modelSize && this.modelSize > 1) {
                    this.modelSize = this.modelSize % 4 / 10;
                    this.model.scale.set(this.modelSize, this.modelSize, this.modelSize);
                }

                // Now apply the position from the hitMatrix onto our model.
                this.model.position.setFromMatrixPosition(hitMatrix);

                // Rather than using the rotation encoded by the `modelMatrix`,
                // rotate the model to face the camera. Use this utility to
                // rotate the model only on the Y axis.
                lookAtOnY(this.model, this.camera);

                // Ensure our model has been added to the scene.
                this.scene.add(this.model);
            }
        }
    }


    window.app = new SelectTest();

});


