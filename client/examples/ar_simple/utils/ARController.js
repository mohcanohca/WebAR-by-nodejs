require.config({
    baseUrl: '/examples/ar_simple',
    paths: {
        io: 'libs/socket.io/socket.io',
        mediaDevices: 'utils/webrtc',
        eventHandlerBase: 'utils/eventHandlerBase',
        ImageController: 'utils/ImageController',
        OrientationController: 'utils/OrientationController',
        OrbitController: 'utils/OrbitController',
        GPSController: 'utils/GPSController',
    }
});
define(['eventHandlerBase', 'mediaDevices', 'ImageController', 'OrientationController', 'OrbitController', 'GPSController'], function (EventHandlerBase, mediaDevices, ImageController, OrientationController, OrbitController, GPSController) {

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
         * @param {THREE.Object} content
         */
        constructor(xrSession, camera, frameOfRef, content) {
            super();

            // 若是开发者传入了自定义的reticle样式，使用该样式
            if (content) {
                this.add(content)
            } else {
                // 否则使用默认样式，即圆环+箭头的标定板
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
                this.loader.load('./assets/Anchor.png', texture => {
                    this.icon.material.opacity = 1;
                    this.icon.material.map = texture;
                });

                this.add(this.ring);
                this.add(this.icon);
            }

            this._session = xrSession;
            this.frameOfRef = frameOfRef;
            this.visible = false;//设置其是否可见
            this.camera = camera;
        }

        /**
         * Fires a hit test in the middle of the screen and places the _reticle
         * upon the surface if found.
         * 在屏幕中心执行击中检测，如果检测到平面，就在上面放置圆环
         * 利用three.js的Raycaster
         *
         * @param {XRCoordinateSystem} frameOfRef
         */
        update(/*frameOfRef*/) {
            this.raycaster = this.raycaster || new THREE.Raycaster();

            // 在屏幕中心执行检测
            this.raycaster.setFromCamera({x: 0, y: 0}, this.camera);
            const ray = this.raycaster.ray;

            const origin = new Float32Array(ray.origin.toArray());
            const direction = new Float32Array(ray.direction.toArray());

            this._session.requestHitTest(origin, direction, this.frameOfRef)
                .then(hits => {
                    if (hits && hits.length) {
                        const hit = hits[0];
                        const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);

                        // Now apply the position from the hitMatrix onto our model
                        // 使用hitMatrix设置模型位置，即标定板的位置
                        //setFromMatrixPosition()将返回从矩阵中的元素得到的新的向量值的向量。设置了this.position.x|y|z的值
                        this.position.setFromMatrixPosition(hitMatrix);

                        lookAtOnY(this, this.camera);

                        this.visible = true;
                    }
                }).catch(e => {
                console.log('hit test failed')
            })

        }
    }

    /**
     * AR控制器基类。
     * 对支持XR的浏览器提供XRSession，支持平面检测；
     * 对于不支持XR的浏览器提供图像控制、方向控制、OrbitControl、GPSControl等几种AR交互方式
     * @param {Boolean} useReticle：表示是否使用平面标定板
     * @param {String} baseControlType： 表示对于不支持AR的浏览器提供的AR体验方案，默认是图像控制
     * @param {Object} baseControlParam：表示基础控制类型的参数，例如对于图像控制，可选择前端识别和后端识别
     */
    class ARControllerBase extends EventHandlerBase {
        constructor(useReticle = false, useSelect = false, baseControlType = ARControllerBase.IMAGECONTROLLER, baseControlParam) {
            super();

            // three.js
            this.renderer = null;
            this.scene = null;
            this.camera = null;
            this.model = null;
            this._gl = null;

            this._videoFrameCanvas = null;//用于绘制视频帧

            //webrtc
            this._videoEl = null;//承载WebRTC获取的视频流的video

            // XR
            this._device = null;//请求的XRDevice
            this._session = null;//请求的XRSession
            this._frameOfRef = null;//参考坐标系
            this.useReticle = useReticle;//是否使用标定板标识平面
            this.useSelect = useSelect;//是否开启XRSession的select事件监听

            this._sessionEls = null;//放置session的DOM
            this._realityEls = null;//放置捕捉的视频流的DOM

            this._baseControlType = baseControlType;//若不支持webxr，采用的基础控制类型
            this._baseControlParam = baseControlParam;//若采用基础控制类，设定的参数

            this.handleARUnable = this.handleARUnable.bind(this);
            this.onXRFrame = this.onXRFrame.bind(this);
            this.enterAR = this.enterAR.bind(this);
            this.init();

        }

        // 初始化，添加用户配置
        init() {
            this._addlisteners();
            this.setAREntrance();
            this.addListeners();
            this.initScene();
            this.initModel();
            // this.dispatchEvent(new CustomEvent(ARControllerBase.ARENABLE));
        }


        /**
         * 检查AR支持性
         * @returns {Promise<void>}
         */
        async detectARFeatures() {
            // 检查navigator.xr是否存在，其实WebXR Device API的入口 XRSession.prototype.requestHitTest需要浏览器开启webxr-hit-test标志保证AR功能可用
            if (navigator.xr && XRSession.prototype.requestHitTest) {
                try {
                    let device = await navigator.xr.requestDevice();
                    this.dispatchEvent(new CustomEvent(ARControllerBase.ARENABLE, {detail: device}))
                } catch (e) {
                    // this.onNoXRDevice();
                    this.dispatchEvent(new CustomEvent(ARControllerBase.ARUNABLE))
                }
            } else {
                // this.onNoXRDevice();
                this.dispatchEvent(new CustomEvent(ARControllerBase.ARUNABLE))
            }
        }


        //若检测到xr设备，准备渲染session的容器
        handleAREnable(event) {
            this._device = event.detail;
            this._sessionEls = document.createElement('div')
            this._sessionEls.setAttribute('class', 'webxr-sessions')

            for (let el of [this._sessionEls/*, this._realityEls*/]) {
                el.style.position = 'absolute'
                el.style.width = '100%'
                el.style.height = '100%'
            }

            // 向body开头插入元素
            let prependElements = () => {
                document.body.style.width = '100%';
                document.body.style.height = '100%';
                // 通过先添加Session的DOM，再添加现实的DOM，保证Session位于现实的上层
                document.body.prepend(this._sessionEls);
            }

            if (document.readyState !== 'loading') {
                prependElements();
            } else {
                document.addEventListener('DOMContentLoaded', prependElements);
            }
            this.enterAR()

        }

        // 当不支持AR时，进入基本控制模式
        handleARUnable() {
            this._sessionEls = document.createElement('div')
            this._sessionEls.setAttribute('class', 'webxr-sessions')

            this._realityEls = document.createElement('div')
            this._realityEls.setAttribute('class', 'webxr-realities')


            for (let el of [this._sessionEls, this._realityEls]) {
                el.style.position = 'absolute'
                el.style.width = '100%'
                el.style.height = '100%'
            }

            // 向body开头插入元素
            let prependElements = () => {
                document.body.style.width = '100%';
                document.body.style.height = '100%';
                // 通过先添加Session的DOM，再添加现实的DOM，保证Session位于现实的上层
                document.body.prepend(this._sessionEls);
                document.body.prepend(this._realityEls); // realities must render behind the sessions
            }

            if (document.readyState !== 'loading') {
                prependElements();
            } else {
                document.addEventListener('DOMContentLoaded', prependElements);
            }

            this.enterAR();
        }

        /**
         * 进入AR会话，会话包括两种形式，一种是支持AR的浏览器提供的XRSession，一种是通过WebRTC请求视频流创建的AR
         * @returns {Promise<void>}
         */
        async enterAR() {
            // 如果检测到XRDevice，继续请求XRSession
            if (this._device) {
                // 创建渲染会话的XRPresentationContext上下文，类似于创建WebGLRenderingContext
                const outputCanvas = document.createElement('canvas');
                const ctx = outputCanvas.getContext('xrpresent');//创建XRPresentationContext，在XRDevice上展示

                try {
                    // 请求XRSession，XRSession暴露设备姿态、用户环境，并处理到设备的渲染
                    let session = await this._device.requestSession({
                        outputContext: ctx,
                        environmentIntegration: true,//表示使用AR模式
                    });
                    this._sessionEls.appendChild(outputCanvas);
                    this.onSessionStarted(session);
                } catch (e) {
                    console.log(e.message);
                    this.dispatchEvent(new CustomEvent(ARControllerBase.ARUNABLE))
                }
            } else {
                // 使用基础类型控制
                // this._openCamera();
                this.requestReality();
            }

        }

        /**
         * 已经为使用three.js渲染并开始动画循环做好准备后
         * 当XRSession开始时调用。
         * 创建three.js中的render、scene、camera
         * 将XRWebGLLayer与XRSession关联
         * 启动循环渲染（render loop）
         */
        async onSessionStarted(session) {
            this.dispatchEvent(new CustomEvent(ARControllerBase.SESSIONSTART));

            this._session = session;

            if (!this._session) {
                //如果没有请求到session，或者当前是基础控制类型

                this.renderer = new THREE.WebGLRenderer({alpha: true});
                this.renderer.autoClear = false;
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setClearColor(0xEEEEEE, 0.0);

                this.camera = new THREE.PerspectiveCamera();
                this.camera.matrixAutoUpdate = false;

                // 创建基础控制类
                this.createBaseController();

                // 调整窗口大小
                this._adjustWindowsSize();

                // 监听窗口大小变化
                this.addEventListener(ARControllerBase.WINDOW_RESIZE_EVENT, this._adjustWindowsSize.bind(this));

                // 在渲染前指定要进行循环的方法
                requestAnimationFrame(this.onXRFrame)

                // 通过监听原生的resize方法，调整元素大小
                window.addEventListener('resize', function () {
                    this.dispatchEvent(ARControllerBase.WINDOW_RESIZE_EVENT)
                }, false);

            } else {

                // 若用户开启了对XRSession的select事件的监听，则对Session添加监听器，各个事件处理函数可被子类覆写
                if (this.useSelect) {
                    session.addEventListener('select', this._handleSelect.bind(this));
                    session.addEventListener('selectstart', this.handleSelectStart.bind(this));
                    session.addEventListener('selectend', this.handleSelectEnd.bind(this));
                } else {
                    //若是没有开启对select事件的监听，默认监听touchstart和click事件
                    window.addEventListener('touchstart', this._handleTouchStart.bind(this), false);
                    window.addEventListener('click', this._handleMouseClick.bind(this), false);
                }


                // 创建一个WebGLRenderer，其包含要使用的第二个canvas
                this.renderer = new THREE.WebGLRenderer({
                    alpha: true,
                    preserveDrawingBuffer: true,
                });
                this.renderer.autoClear = false;

                this.camera = new THREE.PerspectiveCamera();
                this.camera.matrixAutoUpdate = false;

                // 从three.js获取的上下文
                this._gl = this.renderer.getContext();

                // 设置WebGLRenderingContext上下文与XRDevice的兼容性
                await this._gl.setCompatibleXRDevice(this._session.device);

                // 兼容处理后，创建XRWebGLLayer，并将其设备为session的baseLayer。
                // 告诉session，使用上下文gl（来自three.js）绘制scene，显示在用于创建XRPresentationContext的canvas（显示视频流）上层，
                this._session.baseLayer = new XRWebGLLayer(this._session, this._gl);


                //TODO 应该由具体类创建场景
                // this.scene = createCubeScene();

                /*// 若进行平面检测
                if (this.useReticle) {
                    this._reticle = new Reticle(this._session, this.camera);
                    this.scene.add(this._reticle);
                }*/

                // 在开始渲染循环之前，请求eye-level类型的XRFrameOfReference，表明设备正在跟踪位置（而不是像Daydream或Gear VR那样的仅包含方向的VR体验）
                this._frameOfRef = await this._session.requestFrameOfReference('eye-level');

                // 类似于window.requestAnimationFrame，可挂载本机XRDevice的刷新率，标准网页是60FPS，非独占AR会话也是60FPS，但设备的姿势和视图信息只能在会话的requestAnimationFrame中访问。
                this._session.requestAnimationFrame(this.onXRFrame);


                // 若是使用了reticle，即需要为其添加击中检测方法。在scene中添加reticle元素，监听原生click事件
                if (this.useReticle) {
                    this._reticle = new Reticle(this._session, this.camera, this._frameOfRef);
                    this.scene.add(this._reticle)


                    // 手型引导
                    let tipContainer = document.createElement('div');
                    tipContainer.setAttribute('id', 'stabilization');

                    document.body.appendChild(tipContainer);
                    window.addEventListener('click', this.hitTest.bind(this));
                }
            }


        }

        /**
         *  响应XRSession的select事件
         * @param ev
         * @returns {Promise<void>}
         * @private
         */
        async _handleSelect(ev) {
            let inputPose = ev.frame.getInputPose(ev.inputSource, this._frameOfRef);
            if (!inputPose) {
                return;
            }

            // We're going to be firing a ray from the center of the screen.
            // The requestHitTest function takes an x and y coordinate in
            // Normalized Device Coordinates, where the upper left is (-1, 1)
            // and the bottom right is (1, -1). This makes (0, 0) our center.
            const x = 0;
            const y = 0;

            // 检查输入姿态的targetRay对象是否存在，通过targetRay进行击中检测
            if (inputPose.targetRay) {
                const ray = inputPose.targetRay;
                const origin = Float32Array.from((new THREE.Vector3(ray.origin.x, ray.origin.y, ray.origin.z)).toArray());
                const direction = Float32Array.from((new THREE.Vector3(ray.direction.x, ray.direction.y, ray.direction.z)).toArray());

                if (this.useReticle) {
                    // 若是使用了平面检测，就在检测到的平面上添加物体
                    try {
                        let hits = await this._session.requestHitTest(origin, direction, this._frameOfRef)

                        // If we found at least one hit...
                        this.handleSelect(hits);

                    } catch (e) {
                        console.log('hit test failed')
                    }
                }
            }
        }


        /**
         * 响应用户触控事件，使用Three.js的Raycaster方法创建射线，对场景中的物体进行击中测试
         * @param ev
         * @private
         */
        _handleTouchStart(ev) {
            let touch = ev.touches[0];
            let raycaster = new THREE.Raycaster();
            let origin = new THREE.Vector2();
            origin.x = (touch.clientX / window.innerWidth) * 2 - 1;
            origin.y = -(touch.clientY / window.innerHeight) * 2 + 1;

            // 通过鼠标点的位置和当前相机的矩阵计算出raycaster
            raycaster.setFromCamera(origin, this.camera);
            let intersects = raycaster.intersectObjects(this.scene.children);
            this.handleSelect(intersects);
        }

        /**
         * 响应鼠标点击事件，使用Three.js的Raycaster方法创建射线，对场景中的物体进行击中测试
         * @param ev
         * @private
         */
        _handleMouseClick(ev) {
            let raycaster = new THREE.Raycaster();
            let mouse = new THREE.Vector2();
            mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(ev.clientY / window.innerHeight) * 2 + 1;

            // 通过鼠标点的位置和当前相机的矩阵计算出raycaster
            raycaster.setFromCamera(mouse, this.camera);
            let intersects = raycaster.intersectObjects(this.scene.children);

            this.handleSelect(intersects);
        }


        /**
         * 提供给子类的对选中虚拟空间物体的处理事件接口
         * @param intersects raycaster击中结果集合
         */
        handleSelect(intersects) {

        }

        // TODO 由子类覆写
        handleSelectStart(ev) {

        }

        // TODO 由子类覆写
        handleSelectEnd(ev) {

        }

        // 创建基础控制器
        createBaseController() {
            this._sessionEls.appendChild(this.renderer.domElement);

            let baseControlType = this._baseControlType || ARControllerBase.ORBITCONTROLLER;
            switch (baseControlType) {

                case ARControllerBase.IMAGECONTROLLER:
                    console.log('IMAGECONTROLLER');
                    // debugger
                    this._baseController = new ImageController(this._sessionEls, this.renderer, this.scene, this.camera, this.model, this._videoEl, this.modelSize, this._videoFrameCanvas, this._baseControlParam);
                    break;
                case ARControllerBase.ORBITCONTROLLER:
                    this._baseController = new OrbitController(this.renderer, this.scene, this.camera, this.model, this.modelSize)
                    console.log('ORBITCONTROLLER')
                    break;
                case ARControllerBase.ORIENTATIONCONTROLLER:
                    this._baseController = new OrientationController(this.renderer, this.scene, this.camera, this.model, this.modelSize)
                    console.log('ORIENTATIONCONTROLLER')
                    break;
                case ARControllerBase.GPSCONTROLLER:
                    this._baseController = new GPSController(this.renderer, this.scene, this.camera, this.model, this.modelSize)
                    console.log('GPSCONTROLLER');
                    break;
                default:
                    console.log('no basecontroller')
                    break;

            }
        }

        /**
         * 在每一帧调用
         * @param time
         * @param frame：可从frame中获取设备在空间中的姿态（位置+方向），还可获取一组XRView（描述渲染场景的视角）
         */
        onXRFrame(time, frame) {

            if (!this._session) {
                //若是基础控制类型
                this._baseController.onFrame();
                // requestAnimationFrame(this.onXRFrame);

                // this.renderer.clear();
                // this.renderer.render(this.scene, this.camera);
                return;
            }

            const session = frame.session;
            const pose = frame.getDevicePose(this._frameOfRef);

            if (this.useReticle) {
                // Update the _reticle's position
                this._reticle.update(/*this._frameOfRef*/);

                if (this._reticle.visible && !this.stabilized) {
                    this.stabilized = true;
                    document.body.classList.add('stabilized');
                }
            }

            // 在渲染前，排队下一帧动画调用
            session.requestAnimationFrame(this.onXRFrame);

            this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, this._session.baseLayer.framebuffer);

            if (pose) {
                // AR仅有一个view
                for (let view of frame.views) {
                    const viewport = this._session.baseLayer.getViewport(view);
                    this.renderer.setSize(viewport.width, viewport.height);

                    // 使用view提供的projectionMatrix以及从frame获取的设备姿态，设置three.js中相机相关参数，
                    // 这会将虚拟摄像机的位置和方向与我们设备的估计物理位置和方向同步。
                    this.camera.projectionMatrix.fromArray(view.projectionMatrix);
                    const viewMatrix = new THREE.Matrix4().fromArray(pose.getViewMatrix(view));
                    this.camera.matrix.getInverse(viewMatrix);
                    this.camera.updateMatrixWorld(true);

                    this.renderer.clearDepth();

                    // 渲染器使用提供的虚拟摄像机渲染场景
                    this.renderer.render(this.scene, this.camera);
                }
            }
        }


        /**
         * 射线raycast击中测试
         * 利用相机的当前姿态，设置raycast的射线方向
         * 使用XRSession.requestHitTest(origin,direction,XRFrameOfRef)发出射线，检测是否击中虚拟空间，即three.js的scene中的物体
         * @returns {Promise<void>}
         */
        async hitTest() {
            // If our model is not yet loaded, abort
            if (!this.model) {
                return;
            }

            // 缩放模型大小使其能被观察到全貌
            if (this.modelSize && this.modelSize > 1) {
                this.modelSize = this.modelSize % 3 / 10;
                this.model.scale.set(this.modelSize, this.modelSize, this.modelSize);
            }

            // We're going to be firing a ray from the center of the screen.
            // The requestHitTest function takes an x and y coordinate in
            // Normalized Device Coordinates, where the upper left is (-1, 1)
            // and the bottom right is (1, -1). This makes (0, 0) our center.
            const x = 0;
            const y = 0;

            // Create a THREE.Raycaster if one doesn't already exist,
            // and use it to generate an origin and direction from
            // and use it to generate an origin and direction from
            // our camera (device) using the tap coordinates.
            // Learn more about THREE.Raycaster:
            // https://threejs.org/docs/#api/core/Raycaster
            this.raycaster = this.raycaster || new THREE.Raycaster();
            this.raycaster.setFromCamera({x, y}, this.camera);
            const ray = this.raycaster.ray;

            // Fire the hit test to see if our ray collides with a real
            // surface. Note that we must turn our THREE.Vector3 origin and
            // direction into an array of x, y, and z values. The proposal
            // for `XRSession.prototype.requestHitTest` can be found here:
            // https://github.com/immersive-web/hit-test
            const origin = new Float32Array(ray.origin.toArray());
            const direction = new Float32Array(ray.direction.toArray());

            const hits = await this._session.requestHitTest(origin,
                direction,
                this._frameOfRef);

            // If we found at least one hit...
            if (hits.length) {
                // We can have multiple collisions per hit test. Let's just take the
                // first hit, the nearest, for now.
                const hit = hits[0];

                // Our XRHitResult object has one property, `hitMatrix`, a
                // Float32Array(16) representing a 4x4 Matrix encoding position where
                // the ray hit an object, and the orientation has a Y-axis that corresponds
                // with the normal of the object at that location.
                // Turn this matrix into a THREE.Matrix4().
                const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);

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


        onNoXRDevice() {
            document.body.classList.add('unsupported');
        }

        // 设置AR入口，即如何开始AR流程，例如点击按钮
        setAREntrance() {
            //TODO 应该由具体类设置
            // 若要请求XRSession，必须是用户手动触发，例如按钮点击
            document.querySelector('#enter-ar').addEventListener('click', this.detectARFeatures.bind(this));
        }

        // 开发者设定的监听器
        addListeners() {
            //TODO 应该由具体类设置监听

            this.addEventListener(ARControllerBase.SESSIONSTART, function () {
                // 将页面样式切换至ar会话状态
                document.body.classList.add('ar');
            });

        }

        // 初始化three.js中的场景
        initScene() {
            //TODO 应该由具体类创建场景
            // this.scene = createCubeScene();
            console.log('developer need overwritten this method')
        }

        // 初始化three.js中的模型
        initModel() {
            //TODO 应该由具体类创建模型
            console.log('developer need overwritten this method')
        }


        _addlisteners() {
            this.addEventListener(ARControllerBase.ARENABLE, this.handleAREnable.bind(this));
            this.addEventListener(ARControllerBase.ARUNABLE, this.handleARUnable.bind(this));
            this.addEventListener(ARControllerBase.XRDEVICE, this.handleGetDevice.bind(this));
            // this.addEventListener(ARControllerBase.VIDEOSTREAM, this.handleVideoStream.bind(this));
            // this.addEventListener(ARControllerBase.VIDEOREADY, this.handleVideoReady.bind(this));
        }


        // 获取XR设备
        handleGetDevice(event) {
            this._device = event.detail;
        }

        /**
         * 请求现实世界视频流
         */
        requestReality() {
            this.addEventListener(ARControllerBase.VIDEOSTREAM, this.handleVideoStream.bind(this));
            this.addEventListener(ARControllerBase.VIDEOREADY, this.handleVideoReady.bind(this));
            this.addEventListener(ARControllerBase.VIDEOFAILED, this.handleVideoFailed.bind(this));
            // 开启摄像头
            this._openCamera();
        }

        handleVideoFailed() {
            alert('打开摄像头失败，请授权或连接外置摄像头')
        }

        // 打开摄像头
        _openCamera() {
            let _self = this;
            let cameraDeviceIds = [];
            mediaDevices.enumerateDevices().then(function (devices) {
                //获取设备信息
                devices.forEach(_device => {
                    if (_device.kind === 'videoinput') {
                        cameraDeviceIds.push(_device.deviceId);
                    }
                });
            }).then(function () {
                let defaultVideoConstraints = {
                    // width: defaultWidth,
                    // height: defaultHeight,
                    facingMode: "environment",
                    deviceId: cameraDeviceIds[1]
                };

                let constraints = {audio: false, video: defaultVideoConstraints};
                return mediaDevices.getUserMedia(constraints)
                    .then(stream => {
                        _self.dispatchEvent(new CustomEvent(ARControllerBase.VIDEOSTREAM, {detail: stream}));
                    }).catch(e => {
                        _self.dispatchEvent(new CustomEvent(ARControllerBase.VIDEOFAILED))
                    })
            });
        }

        // 获取到视频流后将视频流添加到页面中
        handleVideoStream(event) {
            this._videoEl = document.createElement('video')
            this._realityEls.appendChild(this._videoEl)
            this._videoEl.setAttribute('class', 'camera-reality-video')
            this._videoEl.setAttribute('playsinline', true);

            this._videoEl.style.width = '100%'
            this._videoEl.style.height = '100%'
            if ("srcObject" in this._videoEl) {
                this._videoEl.srcObject = event.detail;
            } else {
                // 防止再新的浏览器里使用它，应为它已经不再支持了
                this._videoEl.src = window.URL.createObjectURL(event.detail);
            }

            this._videoEl.play()
            this._setupWebRTC()
        }

        // 视频加载完成后，创建基础控制实例
        handleVideoReady() {
            this.onSessionStarted();
        }

        // 建立WebRTC，
        _setupWebRTC(parameters) {
            this._videoEl.addEventListener('loadedmetadata', () => {
                var width = this._videoEl.videoWidth;
                var height = this._videoEl.videoHeight;

                // let's pick a size such that the video is below 512 in size in both dimensions
                /*           while (width > 256 || height > 256) {
                               width = width / 2
                               height = height / 2
                           }*/

                this._videoRenderWidth = width;
                this._videoRenderHeight = height;

                this._videoFrameCanvas = document.createElement('canvas');
                this._videoFrameCanvas.width = width;
                this._videoFrameCanvas.height = height;
                this._adjustVideoSize();

                this._addlisteners(ARControllerBase.WINDOW_RESIZE_EVENT, this._adjustVideoSize.bind(this))
                this.dispatchEvent(new CustomEvent(ARControllerBase.VIDEOREADY, {detail: this._videoEl}));
                // this.handleVideoReady();
            });

        }

        // 调整renderer的size和相机广角
        _adjustWindowsSize() {
            /* let canvasWidth = this._videoRenderWidth;
             let canvasHeight = this._videoRenderHeight;*/
            let canvasWidth = window.innerWidth;
            let canvasHeight = window.innerHeight;
            let cameraAspect = canvasWidth / canvasHeight;
            let width = this._videoEl.videoWidth;
            let height = this._videoEl.videoHeight;

            let videoSourceAspect = width / height;
            if (videoSourceAspect != cameraAspect) {
                // let's pick a size such that the video is below 512 in size in both dimensions
                // 选择一个尺寸，使视频在两个维度上都小于512
                /*               while (width > 512 || height > 512) {
                                   width = width / 2
                                   height = height / 2
                               }*/

                // canvasWidth = this._videoRenderWidth = width;
                // canvasHeight = this._videoRenderHeight = height;

                // cameraAspect = canvasWidth / canvasHeight;

            }

            this._videoFrameCanvas.width = canvasWidth;
            this._videoFrameCanvas.height = canvasHeight;

            if (this.camera) {
                this.camera.aspect = cameraAspect;
                this.camera.updateProjectionMatrix();
                // debugger
                this.renderer.setSize(canvasWidth, canvasHeight);
            }


        }

        // 调整视频大小（ARCore或WebRTC获取视频流）
        _adjustVideoSize() {
            var canvasWidth = this._videoRenderWidth;
            var canvasHeight = this._videoRenderHeight;
            var cameraAspect = canvasWidth / canvasHeight;

            var width = this._videoEl.videoWidth;
            var height = this._videoEl.videoHeight;

            var videoSourceAspect = width / height;
            if (videoSourceAspect != cameraAspect) {
                // let's pick a size such that the video is below 512 in size in both dimensions
                // 选择一个尺寸，使视频在两个维度上都小于512
                /*               while (width > 512 || height > 512) {
                                   width = width / 2
                                   height = height / 2
                               }*/

                canvasWidth = this._videoRenderWidth = width;
                canvasHeight = this._videoRenderHeight = height;

                cameraAspect = canvasWidth / canvasHeight;

            }

            // 显示捕捉视频的窗口的尺寸
            var windowWidth = this._realityEls.clientWidth;
            var windowHeight = this._realityEls.clientHeight;
            var windowAspect = windowWidth / windowHeight;

            var translateX = 0;
            var translateY = 0;
            if (cameraAspect > windowAspect) {
                canvasWidth = canvasHeight * windowAspect;
                windowWidth = windowHeight * cameraAspect;
                translateX = -(windowWidth - this._realityEls.clientWidth) / 2;
            } else {
                canvasHeight = canvasWidth / windowAspect;
                windowHeight = windowWidth / cameraAspect;
                translateY = -(windowHeight - this._realityEls.clientHeight) / 2;
            }

            this._videoEl.style.width = windowWidth.toFixed(2) + 'px'
            this._videoEl.style.height = windowHeight.toFixed(2) + 'px'
            this._videoEl.style.transform = "translate(" + translateX.toFixed(2) + "px, " + translateY.toFixed(2) + "px)"
        }

        /**
         * 获取XRSession
         * @returns {null}
         */
        getSession() {
            return this._session;
        }

        /**
         * 返回参考坐标系
         * @returns {null}
         */
        getFrameOfRef() {
            return this._frameOfRef;
        }


    }

    ARControllerBase.ARUNABLE = 'unsupportXR';
    ARControllerBase.ARENABLE = 'supportXR';
    ARControllerBase.XRDEVICE = 'xrdevice';
    ARControllerBase.SESSIONSTART = 'SESSIONSTART';
    ARControllerBase.VIDEOSTREAM = 'video';
    ARControllerBase.VIDEOREADY = 'video_ready';
    ARControllerBase.VIDEOFAILED = 'video_failed';
    ARControllerBase.IMAGECONTROLLER = 'image';
    ARControllerBase.ORBITCONTROLLER = 'orbit';
    ARControllerBase.ORIENTATIONCONTROLLER = 'orientation';
    ARControllerBase.GPSCONTROLLER = 'GPS';
    ARControllerBase.WINDOW_RESIZE_EVENT = 'window-resize';

    return ARControllerBase;
});