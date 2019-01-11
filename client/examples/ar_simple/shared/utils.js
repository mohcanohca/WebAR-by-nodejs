/*
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// remaps opacity from 0 to 1
const opacityRemap = mat => {
    if (mat.opacity === 0) {
        mat.opacity = 1;
    }
};

class ThreeJSController {
    constructor() {
        this.renderer = null;
        this.camera = null;
        this.scene = null;
        this.model = null;
        this.addModel = this.addModel.bind(this);
        this.updateCamera = this.updateCamera.bind(this);
        this.updateModelPosition = this.updateModelPosition.bind(this);
        this.render = this.render.bind(this);
        this.setModelFromMatrixPosition = this.setModelFromMatrixPosition.bind(this)
        this.init();
    }

    //初始化Three.js的必要组件
    init() {
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xffffff, 1);
        this.camera = new THREE.PerspectiveCamera();
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
        if (modelSize) {
            this.model.scale.x = modelSize;
            this.model.scale.y = modelSize;
            this.model.scale.z = modelSize;
        }

        if (rotation) {
            this.model.rotation.x = -Math.asin(-rotation[1][2]);
            this.model.rotation.y = -Math.atan2(rotation[0][2], rotation[2][2]);
            this.model.rotation.z = Math.atan2(rotation[1][0], rotation[1][1]);

        }

        if (translation) {
            this.model.position.x = translation[0];
            this.model.position.y = translation[1];
            this.model.position.z = -translation[2];
        }

    }

    updateModelPosition(position) {
        this.model.position.x = position.x || 0;
        this.model.position.y = position.y || 0;
        this.model.position.z = position.z || 0;
    }

    setScene(scene) {
        this.scene = scene;
    }

    setRendererProps(props) {
        for (let i in props) {
            this.renderer[i] = props[i];
        }
    }

    setThreeCameraProps(props) {
        for (let i in props) {
            this.camera[i] = props[i];
        }
    }

    setModelFromMatrixPosition(matrix) {
        this.model.position.setFromMatrixPosition(matrix)
    }

    updateCamera(pose) {
        if (pose.viewMatrix) {
            // 将camera的matrix与viewMatrix的逆矩阵相乘
            this.camera.matrix.getInverse(pose.viewMatrix);
            //更新世界矩阵。如果父对象发生了形变，那么他的形变需要传递到下面所有的子对象 。
            this.camera.updateMatrixWorld(true);
        }
        if (pose.projectionMatrix) {
            this.camera.projectionMatrix.fromArray(pose.projectionMatrix);
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

/**
 * The Reticle class creates an object that repeatedly calls
 * `xrSession.requestHitTest()` to render a ring along a found
 * horizontal surface.
 * Reticle类创建一个对象，该对象重复调用XRSession.requestHitTest()方法在找到的水平面上渲染圆环
 */
class Reticle extends THREE.Object3D {
    /**
     * @param {XRSession} xrSession
     * @param {THREE.Camera} camera
     */
    constructor(xrSession, camera) {
        super();

        this.loader = new THREE.TextureLoader();

        let geometry = new THREE.RingGeometry(0.1, 0.11, 24, 1);
        let material = new THREE.MeshBasicMaterial({color: 0xffffff});
        // Orient the geometry so its position is flat on a horizontal surface
        //  确定几何图形的方向，使其在水平面上
        geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90)));

        this.ring = new THREE.Mesh(geometry, material);

        geometry = new THREE.PlaneBufferGeometry(0.15, 0.15);
        // Orient the geometry so its position is flat on a horizontal surface,
        // as well as rotate the image so the anchor is facing the user
        //确定几何图形的方向，使其在水平面，同时旋转图像，使锚面向用户
        geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90)));
        geometry.applyMatrix(new THREE.Matrix4().makeRotationY(THREE.Math.degToRad(0)));
        material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0
        });
        this.icon = new THREE.Mesh(geometry, material);

        // Load the anchor texture and apply it to our material
        // once loaded
        this.loader.load('../assets/Anchor.png', texture => {
            this.icon.material.opacity = 1;
            this.icon.material.map = texture;
        });

        this.add(this.ring);
        this.add(this.icon);

        this.session = xrSession;
        this.visible = false;
        this.camera = camera;
    }

    /**
     * Fires a hit test in the middle of the screen and places the reticle
     * upon the surface if found.
     *在屏幕中心执行击中检测，如果检测到平面，就在上面放置圆环
     * 利用three.js的Raycaster
     *
     * @param {XRCoordinateSystem} frameOfRef
     */
    async update(frameOfRef) {
        this.raycaster = this.raycaster || new THREE.Raycaster();
        this.raycaster.setFromCamera({x: 0, y: 0}, this.camera);
        const ray = this.raycaster.ray;

        const origin = new Float32Array(ray.origin.toArray());
        const direction = new Float32Array(ray.direction.toArray());
        this.session.requestHitTest(origin, direction, frameOfRef).then(hits => {
            console.log(hits)
            if (hits && hits.length) {
                const hit = hits[0];
                const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);

                // Now apply the position from the hitMatrix onto our model
                // 使用hitMatrix设置模型位置
                //setFromMatrixPosition()将返回从矩阵中的元素得到的新的向量值的向量。设置了this.position.x|y|z的值
                this.position.setFromMatrixPosition(hitMatrix);

                DemoUtils.lookAtOnY(this, this.camera);

                this.visible = true;
            }
        }).catch(e=>{console.log(e)})
        /*const hits = await this.session.requestHitTest(origin,
            direction,
            frameOfRef);
        console.log(hits)*/


    }
}

window.DemoUtils = {
    /**
     * Creates a THREE.Scene containing lights that case shadows,
     * and a mesh that will receive shadows.
     *
     * @return {THREE.Scene}
     */
    createLitScene() {
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
    },

    /**
     * Creates a THREE.Scene containing cubes all over the scene.
     *
     * @return {THREE.Scene}
     */
    createCubeScene() {
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
    },

    /**
     * Loads an OBJ model with an MTL material applied.
     * Returns a THREE.Group object containing the mesh.
     *
     * @param {string} objURL
     * @param {string} mtlURL
     * @return {Promise<THREE.Group>}
     */
    loadModel(objURL, mtlURL) {
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
    },

    /**
     * Similar to THREE.Object3D's `lookAt` function, except we only
     * want to rotate on the Y axis. In our AR use case, we don't want
     * our model rotating in all axes, instead just on the Y.
     * 类似于THREE.js中3D物体的lookAt方法，但是在此处仅仅旋转Y轴。
     *
     * @param {THREE.Object3D} looker
     * @param {THREE.Object3D} target
     */
    lookAtOnY(looker, target) {
        //matrixWorld表示物体的全局形变，表示物体在场景中的位置，通过local matrix（object.matrix）与父亲的matrixWorld递归相乘得到的
        // setFromMatrixPosition(matrix)将matrix转换成向量
        const targetPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);

        const angle = Math.atan2(targetPos.x - looker.position.x,
            targetPos.z - looker.position.z);

        looker.rotation.set(0, angle, 0);
    },
};
