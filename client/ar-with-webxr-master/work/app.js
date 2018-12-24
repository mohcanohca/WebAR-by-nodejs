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

/**
 * Container class to manage connecting to the WebXR Device API
 * and handle rendering on every frame.
 */
class App {
    constructor() {
        this.onXRFrame = this.onXRFrame.bind(this);
        this.onEnterAR = this.onEnterAR.bind(this);
        this.init();
    }

    /**
     * Fetches the XRDevice, if available. 获取XRDevice(如果可用)
     */
    async init() {
        // The entry point of the WebXR Device API is on `navigator.xr`.  WebXR Device API的入口在navigator.xr
        // We also want to ensure that `XRSession` has `requestHitTest`,  还需要确认XRSession具有requistHitTest方法
        // indicating that the #webxr-hit-test flag is enabled. requestHitTest表示webxr-hit-test可用
        if (navigator.xr && XRSession.prototype.requestHitTest) {
            try {
                //通过navigator.xr.requestDevice()请求一个设备，该设备返回一个Promise对象。若存在可用XR设备，该Promise过渡到resolve状态，返回XRDevice；若不存在可用XR设备，过渡到reject
                this.device = await navigator.xr.requestDevice();
            } catch (e) {
                //若没有检测到可用的XR设备，提示不存在XR设备
                // If there are no valid XRDevice's on the system,
                // `requestDevice()` rejects the promise. Catch our
                // awaited promise and display message indicating there
                // are no valid devices.
                this.onNoXRDevice();
                return;
            }
        } else {
            // 若navigator.xr或XRSession.prototype.requestHitTest有一个不存在，提升不存在支持XR的设备
            // If `navigator.xr` or `XRSession.prototype.requestHitTest`
            // does not exist, we must display a message indicating there
            // are no valid devices.
            this.onNoXRDevice();
            return;
        }


        //已经获取到一个XRDevice用户可通过点击"Enter AR"按钮，获取AR服务
        // We found an XRDevice! Bind a click listener on our "Enter AR" button
        // since the spec requires calling `device.requestSession()` within a
        // user gesture.
        document.querySelector('#enter-ar').addEventListener('click', this.onEnterAR);
    }

    /**
     * Handle a click event on the '#enter-ar' button and attempt to
     * start an XRSession.
     * 开始一个XRSession
     */
    async onEnterAR() {
        //在init()已经获取到XRDevice，并响应用户的手势进入到AR体验环节。
        //在canvas元素上创建一个XR展示上下文。
        // Now that we have an XRDevice, and are responding to a user
        // gesture, we must create an XRPresentationContext on a
        // canvas element.
        const outputCanvas = document.createElement('canvas');
        const ctx = outputCanvas.getContext('xrpresent');

        try {
            //使用上面创建的XRPresentationContext为XRDevice请求一个会话，即一个XRSession对象
            //通过XRSession对象与XR硬件交互，XRSession只能通过调用XR对象的requestSession()获取。
            // 成功获取会话后，可以轮循设备姿态，请求用户环境信息，向用户展示图像。
            // Request a session for the XRDevice with the XRPresentationContext
            // we just created.
            // Note that `device.requestSession()` must be called in response to
            // a user gesture, hence this function being a click handler.
            const session = await this.device.requestSession({
                outputContext: ctx,//创建的XRPresentationContext
                environmentIntegration: true,//环境整合：true。表示想要使用AR功能
            });
            // console.log(session)
            //若requestSession成功获取到一个session，将用于展示XR上下文的canvas添加到页面DOM
            // If `requestSession` is successful, add the canvas to the
            // DOM since we know it will now be used.
            document.body.appendChild(outputCanvas);
            //为session添加监听器
            this.onSessionStarted(session)
        } catch (e) {
            // If `requestSession` fails, the canvas is not added, and we
            // call our function for unsupported browsers.
            this.onNoXRDevice();
        }
    }

    /**
     * Toggle on a class on the page to disable the "Enter AR"
     * button and display the unsupported browser message.
     */
    onNoXRDevice() {
        document.body.classList.add('unsupported');
    }

    /**
     * 当XRSession开始时调用。
     * 创建three.js中的render、scene、camera
     * 将XRWebGLLayer与XRSession关联
     * 启动循环渲染（render loop）
     * Called when the XRSession has begun. Here we set up our three.js
     * renderer, scene, and camera and attach our XRWebGLLayer to the
     * XRSession and kick off the render loop.
     */
    async onSessionStarted(session) {
        this.session = session;

        // Add the `ar` class to our body, which will hide our 2D components
        document.body.classList.add('ar');

        //使用three.js在web渲染3D。
        // To help with working with 3D on the web, we'll use three.js. Set up
        // the WebGLRenderer, which handles rendering to our session's base layer.
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
        });
        this.renderer.autoClear = false;

        //获取WebGLRenderer的上下文，类似于canvas.getContext
        this.gl = this.renderer.getContext();

        //确保待写入的上下文与XRDevice兼容
        // Ensure that the context we want to write to is compatible
        // with our XRDevice
        await this.gl.setCompatibleXRDevice(this.session.device);

        //以上下文gl创建一个XRWebGLLayer对象，并将XRWebGLLayer设置为XRSession（即session）的baseLayer。
        //告诉session要使用context绘制scene，独立的显示在init()中创建的canvas中，置于现实世界视频流上层
        //XRWebGLLayer是一个层，提供WebGL帧缓冲区以进行渲染。可以在XR设备上呈现3D图形的硬件加速渲染
        // Set our session's baseLayer to an XRWebGLLayer
        // using our new renderer's context
        this.session.baseLayer = new XRWebGLLayer(this.session, this.gl);

        //DemoUtils对three.js中的方法进行了二次封装
        //创建一个包含多个正方体的场景
        // A THREE.Scene contains the scene graph for all objects in the
        // render scene.
        // Call our utility which gives us a THREE.Scene populated with
        // cubes everywhere.
        this.scene = DemoUtils.createCubeScene();

        //禁用three.js中camera的自动更新，而是直接使用从API获取的相机矩阵更新
        // We'll update the camera matrices directly from API, so
        // disable matrix auto updates so three.js doesn't attempt
        // to handle the matrices independently.
        this.camera = new THREE.PerspectiveCamera();
        this.camera.matrixAutoUpdate = false;

        //获取'eye-level'的的 XRFrameOfReference ，表示设备是实时跟踪位置的
        this.frameOfRef = await this.session.requestFrameOfReference('eye-level');
        //当获取帧的引用后，调用requestAnimationFrame开始循环渲染 render loop，AR的帧率是60FPS，设备的姿态和视图只能通过XRPresentation.requestAnimationFrame获取
        //每一帧都会调用this.onXRFrame，默认传入参数：时间戳，XRPresentationFrame
        this.session.requestAnimationFrame(this.onXRFrame);
    }

    /**
     * XRFrame提供将XR场景的单个帧渲染到XR设备显示所需的所有值。
     * Called on the XRSession's requestAnimationFrame.
     * Called with the time and XRPresentationFrame.
     * XRPresentationFrame提供getDevicePose()获取设备姿态，提供一个XRViews数组，描述了在当前设备上正确渲染scene应该呈现的视点
     */
    onXRFrame(time, frame) {
        let session = frame.session;//获取产生该frame的XRSession，XRSession与XR硬件交互

        //获取当前姿态，WebXR标准中为getViewerPose(XRFrameOfReference xrReferenceSpace)
        let pose = frame.getDevicePose(this.frameOfRef);

        // Queue up the next frame  排队等待下一帧动画，即在下一帧动画产生时再次调用this.onXRFrame
        session.requestAnimationFrame(this.onXRFrame);

        // Bind the framebuffer to our baseLayer's framebuffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.session.baseLayer.framebuffer);

        if (pose) {
            // Our XRFrame has an array of views. In the VR case, we'll have
            // two views, one for each eye. In mobile AR, however, we only
            // have one view.
            for (let view of frame.views) {//在WebXR标准中，应该是XRViewerPose.views
                //获取视点
                const viewport = session.baseLayer.getViewport(view);
                this.renderer.setSize(viewport.width, viewport.height);

                // 通过XRDevicePose获取的视图矩阵和通过XRView获取的投影矩阵，更新three.js中的相机的姿态
                //这同步（虚拟相机的位置和方向）与（设备的估计物理位置和方向）。
                // Set the view matrix and projection matrix from XRDevicePose
                // and XRView onto our THREE.Camera.
                this.camera.projectionMatrix.fromArray(view.projectionMatrix);
                const viewMatrix = new THREE.Matrix4().fromArray(pose.getViewMatrix(view));
                this.camera.matrix.getInverse(viewMatrix);
                this.camera.updateMatrixWorld(true);

                //渲染器渲染场景与虚拟相机。
                // Render our scene with our THREE.WebGLRenderer
                this.renderer.render(this.scene, this.camera);
            }
        }
    }
};

window.app = new App();
