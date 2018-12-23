require.config({
    paths: {
        orbitController: '../utils/OrbitControls',
    }
});
define(['orbitController'], function (orbitController) {
    let defaultWidth = window.innerWidth;
    let defaultHeight = window.innerHeight;

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

    function _OrbitControl(camera) {
        //构造函数
        THREE.OrbitControls = function (object, domElement) {

            // this.mouseDown = false;
            this.object = object;

            this.domElement = (domElement !== undefined) ? domElement : document;

            // Set to false to disable this control
            this.enabled = true;

            // "target" sets the location of focus, where the object orbits around（target属性表示物体旋转的中心）
            this.target = new THREE.Vector3();

            // How far you can dolly in and out ( PerspectiveCamera only )（可以移动的位置范围，仅支持透视投影相机）
            this.minDistance = 0;
            this.maxDistance = Infinity;

            // How far you can zoom in and out ( OrthographicCamera only )（可以缩放的方位，仅支持正交投影相机）
            this.minZoom = 0;
            this.maxZoom = Infinity;

            // How far you can orbit（旋转） vertically（垂直地）, upper and lower limits.（可以垂直旋转的范围）
            // Range is 0 to Math.PI radians.（0~π）
            this.minPolarAngle = 0; // radians
            this.maxPolarAngle = Math.PI; // radians

            // How far you can orbit horizontally（水平的）, upper and lower limits.（可以水平旋转的范围）
            // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
            this.minAzimuthAngle = -Infinity; // radians
            this.maxAzimuthAngle = Infinity; // radians

            // Set to true to enable damping（抑制） (inertia（惯性）)（enableDamping用于抑制惯性的效果）
            // If damping is enabled, you must call controls.update() in your animation loop（若设置enableDamping为true，需要在动画循环中调用controls.update()更新）
            this.enableDamping = false;
            this.dampingFactor = 0.25;

            // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.（enableZoom用于设置是否允许缩放）
            // Set to false to disable zooming
            this.enableZoom = true;
            this.zoomSpeed = 1.0;

            // Set to false to disable rotating
            this.enableRotate = true;
            this.rotateSpeed = 1.0;

            // Set to false to disable panning
            this.enablePan = true;
            this.panSpeed = 1.0;
            this.screenSpacePanning = false; // if true, pan in screen-space
            this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

            // Set to true to automatically rotate around the target
            // If auto-rotate is enabled, you must call controls.update() in your animation loop
            this.autoRotate = false;
            this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

            // Set to false to disable use of the keys（是否允许使用键控制）
            this.enableKeys = true;

            // The four arrow keys
            this.keys = {LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40};

            // Mouse buttons
            this.mouseButtons = {LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE, RIGHT: THREE.MOUSE.RIGHT};

            // for reset（用于重置？？？？）
            this.target0 = this.target.clone();
            this.position0 = this.object.position.clone();
            this.zoom0 = this.object.zoom;

            //
            // public methods
            //

            //获取极角
            this.getPolarAngle = function () {

                return spherical.phi;

            };

            //获取方位角
            this.getAzimuthalAngle = function () {

                return spherical.theta;

            };

            //保存状态
            this.saveState = function () {
                //scope指向this，当前构造的对象
                scope.target0.copy(scope.target);
                scope.position0.copy(scope.object.position);
                scope.zoom0 = scope.object.zoom;

            };

            //重置
            this.reset = function () {
                //scope指向this，当前构造的对象
                scope.target.copy(scope.target0);
                scope.object.position.copy(scope.position0);
                scope.object.zoom = scope.zoom0;

                scope.object.updateProjectionMatrix();
                scope.dispatchEvent(changeEvent);

                scope.update();

                state = STATE.NONE;

            };

            // this method is exposed, but perhaps it would be better if we can make it private...（update方法被暴露出来，若是将它设置为私有方法更好）
            this.update = function () {

                var offset = new THREE.Vector3();

                // so camera.up is the orbit axis
                //setFromUnitVectors(vFrom,vTo)：将该四元数设置为由vFrom向量到vTo向量所需要的旋转量
                var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));//由object.up和一个向量生成一个四元数
                var quatInverse = quat.clone().inverse();//求这个四元数的倒数——计算共轭，然后使结果标准化。

                var lastPosition = new THREE.Vector3();
                var lastQuaternion = new THREE.Quaternion();

                return function update() {

                    var position = scope.object.position;

                    //计算物体位置与旋转中心的偏移量，其实就是得出在当前球面坐标系中，物体的位置
                    offset.copy(position).sub(scope.target);

                    // rotate offset to "y-axis-is-up" space 通过四元数旋转物体。
                    offset.applyQuaternion(quat);

                    // angle from z-axis around y-axis（从z轴到y轴的角度）基于offset向量设置spherical的radius，phi（与y轴正方向的夹角）和theta（绕y轴旋转的角度）属性
                    spherical.setFromVector3(offset);

                    //若设置了自动旋转，切虚拟物体无状态，向左旋转
                    if (scope.autoRotate && state === STATE.NONE) {

                        rotateLeft(getAutoRotationAngle());

                    }

                    spherical.theta += sphericalDelta.theta;
                    spherical.phi += sphericalDelta.phi;

                    // 将theta和phi的值限定在期望范围内
                    // restrict theta to be between desired limits
                    spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));

                    // restrict phi to be between desired limits
                    spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));

                    //确保phi值在正常范围内
                    spherical.makeSafe();


                    //球面坐标系的半径缩放
                    spherical.radius *= scale;

                    // restrict radius to be between desired limits
                    spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

                    // move target to panned location 将中心点移动到平移到的位置
                    scope.target.add(panOffset);

                    //获取物体在球面坐标中的坐标
                    offset.setFromSpherical(spherical);

                    // rotate offset back to "camera-up-vector-is-up" space 偏移量旋转回“相机-向上-矢量-向上”空间
                    offset.applyQuaternion(quatInverse);

                    //重新计算得到物体的当前位置
                    position.copy(scope.target).add(offset);

                    scope.object.lookAt(scope.target);

                    if (scope.enableDamping === true) {

                        sphericalDelta.theta *= (1 - scope.dampingFactor);
                        sphericalDelta.phi *= (1 - scope.dampingFactor);

                        panOffset.multiplyScalar(1 - scope.dampingFactor);

                    } else {

                        sphericalDelta.set(0, 0, 0);

                        //平移量清空
                        panOffset.set(0, 0, 0);

                    }

                    scale = 1;

                    // update condition is:
                    // min(camera displacement, camera rotation in radians)^2 > EPS
                    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

                    if (zoomChanged ||
                        lastPosition.distanceToSquared(scope.object.position) > EPS ||
                        8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {

                        scope.dispatchEvent(changeEvent);

                        lastPosition.copy(scope.object.position);
                        lastQuaternion.copy(scope.object.quaternion);
                        zoomChanged = false;

                        return true;

                    }

                    return false;

                };

            }();

            //移除所有事件监听器
            this.dispose = function () {

                scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
                scope.domElement.removeEventListener('mousedown', onMouseDown, false);
                scope.domElement.removeEventListener('wheel', onMouseWheel, false);

                scope.domElement.removeEventListener('touchstart', onTouchStart, false);
                scope.domElement.removeEventListener('touchend', onTouchEnd, false);
                scope.domElement.removeEventListener('touchmove', onTouchMove, false);

                document.removeEventListener('mousemove', onMouseMove, false);
                document.removeEventListener('mouseup', onMouseUp, false);

                window.removeEventListener('keydown', onKeyDown, false);

                //scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

            };

            //
            // internals（内部构件）
            //

            var scope = this;

            var changeEvent = {type: 'change'};
            var startEvent = {type: 'start'};
            var endEvent = {type: 'end'};

            var STATE = {NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY_PAN: 4};

            var state = STATE.NONE;

            var EPS = 0.000001;

            // current position in spherical coordinates（在球面坐标中的当前位置）
            var spherical = new THREE.Spherical();//Spherical(radius, phi, theta)：radius默认1.0，以y轴正方向为向上，phi表示与y轴正方向的夹角，theta表示绕y轴旋转的值，默认都为0
            var sphericalDelta = new THREE.Spherical();

            var scale = 1;
            var panOffset = new THREE.Vector3();//平移量{x:0,y:0,z:0}
            var zoomChanged = false;

            var rotateStart = new THREE.Vector2();//{x:0,y:0}
            var rotateEnd = new THREE.Vector2();
            var rotateDelta = new THREE.Vector2();

            var panStart = new THREE.Vector2();
            var panEnd = new THREE.Vector2();
            var panDelta = new THREE.Vector2();

            var dollyStart = new THREE.Vector2();
            var dollyEnd = new THREE.Vector2();
            var dollyDelta = new THREE.Vector2();

            function getAutoRotationAngle() {

                return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

            }

            //获取缩放比例，默认缩放比例为1
            function getZoomScale() {

                return Math.pow(0.95, scope.zoomSpeed);

            }

            //向左旋转
            function rotateLeft(angle) {

                sphericalDelta.theta -= angle;

            }

            //向上旋转
            function rotateUp(angle) {

                sphericalDelta.phi -= angle;

            }

            //向左平移
            var panLeft = function () {

                var v = new THREE.Vector3();

                return function panLeft(distance, objectMatrix) {

                    v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix（获取物体姿态矩阵的表示X的列）
                    v.multiplyScalar(-distance);//向左为负

                    panOffset.add(v);

                };

            }();

            //向上平移
            var panUp = function () {

                var v = new THREE.Vector3();

                return function panUp(distance, objectMatrix) {

                    if (scope.screenSpacePanning === true) {

                        v.setFromMatrixColumn(objectMatrix, 1);//取出表示Y轴的列

                    } else {

                        v.setFromMatrixColumn(objectMatrix, 0);
                        v.crossVectors(scope.object.up, v);

                    }

                    v.multiplyScalar(distance);

                    panOffset.add(v);

                };

            }();

            // deltaX and deltaY are in pixels; right and down are positive（deltaX和deltaY是以像素为单位，向右和向下为正）
            var pan = function () {

                var offset = new THREE.Vector3();

                return function pan(deltaX, deltaY) {

                    var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

                    if (scope.object.isPerspectiveCamera) {
                        //对于透视投影相机的处理

                        // perspective
                        var position = scope.object.position;
                        offset.copy(position).sub(scope.target);//计算出偏移量offset
                        var targetDistance = offset.length();

                        // half of the fov is center to top of screen
                        targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0);

                        // we use only clientHeight here so aspect ratio does not distort speed（为保证不会长宽比不会扭曲速度，此处使用clientHeight）
                        panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
                        panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);

                    } else if (scope.object.isOrthographicCamera) {
                        //对于正交投影相机的处理
                        // orthographic
                        panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix);
                        panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix);

                    } else {

                        // camera neither orthographic nor perspective
                        console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
                        scope.enablePan = false;

                    }

                };

            }();

            /**
             * 放大，整部摄影机向前移动
             * @param dollyScale 缩放比例
             */
            function dollyIn(dollyScale) {

                if (scope.object.isPerspectiveCamera) {

                    scale /= dollyScale;

                } else if (scope.object.isOrthographicCamera) {

                    scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale));
                    scope.object.updateProjectionMatrix();
                    zoomChanged = true;

                } else {

                    console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
                    scope.enableZoom = false;

                }

            }

            /**
             * 缩小，整部摄影机向后移动
             * @param dollyScale 缩放比例
             */
            function dollyOut(dollyScale) {

                if (scope.object.isPerspectiveCamera) {

                    scale *= dollyScale;

                } else if (scope.object.isOrthographicCamera) {

                    scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale));
                    scope.object.updateProjectionMatrix();
                    zoomChanged = true;

                } else {

                    console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
                    scope.enableZoom = false;

                }

            }

            //
            // event callbacks - update the object state（回调事件 - 更新虚拟物体的状态）
            //

            //处理鼠标按下旋转事件
            function handleMouseDownRotate(event) {

                //console.log( 'handleMouseDownRotate' );

                //设置旋转的初态
                rotateStart.set(event.clientX, event.clientY);

            }

            function handleMouseDownDolly(event) {

                //console.log( 'handleMouseDownDolly' );

                dollyStart.set(event.clientX, event.clientY);

            }

            function handleMouseDownPan(event) {

                //console.log( 'handleMouseDownPan' );

                panStart.set(event.clientX, event.clientY);

            }

            //处理鼠标按下移动导致的旋转事件
            function handleMouseMoveRotate(event) {

                //console.log( 'handleMouseMoveRotate' );

                //设置旋转的终态
                rotateEnd.set(event.clientX, event.clientY);

                //基于初始状态和结束状态，计算差值，再乘上旋转速度，得到旋转量
                rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

                var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

                //计算出向左旋转角度和向上旋转角度
                rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height

                rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

                //以当前的终态作为下次鼠标移动的初态
                rotateStart.copy(rotateEnd);

                //更新虚拟物体状态
                scope.update();

            }

            function handleMouseMoveDolly(event) {

                //console.log( 'handleMouseMoveDolly' );

                dollyEnd.set(event.clientX, event.clientY);

                dollyDelta.subVectors(dollyEnd, dollyStart);

                if (dollyDelta.y > 0) {

                    dollyIn(getZoomScale());

                } else if (dollyDelta.y < 0) {

                    dollyOut(getZoomScale());

                }

                dollyStart.copy(dollyEnd);

                scope.update();

            }

            function handleMouseMovePan(event) {

                //console.log( 'handleMouseMovePan' );

                panEnd.set(event.clientX, event.clientY);

                panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

                pan(panDelta.x, panDelta.y);

                panStart.copy(panEnd);

                scope.update();

            }

            function handleMouseUp(event) {

            }

            function handleMouseWheel(event) {

                // console.log( 'handleMouseWheel' );

                if (event.deltaY < 0) {

                    dollyOut(getZoomScale());

                } else if (event.deltaY > 0) {

                    dollyIn(getZoomScale());

                }

                scope.update();

            }

            function handleKeyDown(event) {

                //console.log( 'handleKeyDown' );

                switch (event.keyCode) {

                    case scope.keys.UP:
                        pan(0, scope.keyPanSpeed);
                        scope.update();
                        break;

                    case scope.keys.BOTTOM:
                        pan(0, -scope.keyPanSpeed);
                        scope.update();
                        break;

                    case scope.keys.LEFT:
                        pan(scope.keyPanSpeed, 0);
                        scope.update();
                        break;

                    case scope.keys.RIGHT:
                        pan(-scope.keyPanSpeed, 0);
                        scope.update();
                        break;

                }

            }

            function handleTouchStartRotate(event) {

                //console.log( 'handleTouchStartRotate' );

                rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);

            }

            function handleTouchStartDollyPan(event) {

                //console.log( 'handleTouchStartDollyPan' );

                if (scope.enableZoom) {

                    var dx = event.touches[0].pageX - event.touches[1].pageX;
                    var dy = event.touches[0].pageY - event.touches[1].pageY;

                    var distance = Math.sqrt(dx * dx + dy * dy);

                    dollyStart.set(0, distance);

                }

                if (scope.enablePan) {

                    var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
                    var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

                    panStart.set(x, y);

                }

            }

            function handleTouchMoveRotate(event) {

                //console.log( 'handleTouchMoveRotate' );

                rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);

                rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

                var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

                rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height

                rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

                rotateStart.copy(rotateEnd);

                scope.update();

            }

            function handleTouchMoveDollyPan(event) {

                //console.log( 'handleTouchMoveDollyPan' );

                if (scope.enableZoom) {

                    var dx = event.touches[0].pageX - event.touches[1].pageX;
                    var dy = event.touches[0].pageY - event.touches[1].pageY;

                    var distance = Math.sqrt(dx * dx + dy * dy);

                    dollyEnd.set(0, distance);

                    dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed));

                    dollyIn(dollyDelta.y);

                    dollyStart.copy(dollyEnd);

                }

                if (scope.enablePan) {

                    var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
                    var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

                    panEnd.set(x, y);

                    panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

                    pan(panDelta.x, panDelta.y);

                    panStart.copy(panEnd);

                }

                scope.update();

            }

            function handleTouchEnd(event) {

                //console.log( 'handleTouchEnd' );

            }

            //
            // event handlers - FSM: listen for events and reset state（事件句柄 - 根据不同的事件触发情况添加对应的回调处理函数以及重置状态）
            //

            function onMouseDown(event) {

                if (scope.enabled === false) return;

                event.preventDefault();

                switch (event.button) {

                    case scope.mouseButtons.LEFT://若是按下鼠标左键

                        if (event.ctrlKey || event.metaKey) {//判断是否按下控制平移的按键

                            if (scope.enablePan === false) return;

                            handleMouseDownPan(event);

                            state = STATE.PAN;

                        } else {//发出旋转事件

                            //若不允许旋转，返回。不响应鼠标事件
                            if (scope.enableRotate === false) return;

                            //执行鼠标按下旋转的处理函数
                            handleMouseDownRotate(event);

                            //将状态切换成旋转
                            state = STATE.ROTATE;

                        }

                        break;

                    case scope.mouseButtons.MIDDLE://若是按下鼠标滚轮，进入"缩放"处理流程

                        //若不允许缩放，返回
                        if (scope.enableZoom === false) return;

                        //执行鼠标按下缩放的处理函数
                        handleMouseDownDolly(event);

                        //将状态切换成缩放状态
                        state = STATE.DOLLY;

                        break;

                    case scope.mouseButtons.RIGHT://若是按下鼠标右键

                        //若不允许平移，返回
                        if (scope.enablePan === false) return;

                        //执行鼠标按下平移的处理函数
                        handleMouseDownPan(event);

                        //将状态切换成平移状态
                        state = STATE.PAN;

                        break;

                }

                if (state !== STATE.NONE) {//若存在一种状态，继续监听鼠标的移动以及抬起

                    document.addEventListener('mousemove', onMouseMove, false);
                    document.addEventListener('mouseup', onMouseUp, false);

                    //触发startEvent事件
                    scope.dispatchEvent(startEvent);

                }

            }

            //鼠标移动处理事件
            function onMouseMove(event) {

                if (scope.enabled === false) return;

                event.preventDefault();

                switch (state) {

                    case STATE.ROTATE:

                        if (scope.enableRotate === false) return;

                        handleMouseMoveRotate(event);
                        break;

                    case STATE.DOLLY:

                        if (scope.enableZoom === false) return;

                        handleMouseMoveDolly(event);

                        break;

                    case STATE.PAN:

                        if (scope.enablePan === false) return;

                        handleMouseMovePan(event);

                        break;

                }

            }

            function onMouseUp(event) {

                if (scope.enabled === false) return;

                handleMouseUp(event);

                document.removeEventListener('mousemove', onMouseMove, false);
                document.removeEventListener('mouseup', onMouseUp, false);

                scope.dispatchEvent(endEvent);

                state = STATE.NONE;

            }

            function onMouseWheel(event) {

                if (scope.enabled === false || scope.enableZoom === false || (state !== STATE.NONE && state !== STATE.ROTATE)) return;

                event.preventDefault();
                event.stopPropagation();

                scope.dispatchEvent(startEvent);

                handleMouseWheel(event);

                scope.dispatchEvent(endEvent);

            }

            function onKeyDown(event) {

                if (scope.enabled === false || scope.enableKeys === false || scope.enablePan === false) return;

                handleKeyDown(event);

            }

            function onTouchStart(event) {

                if (scope.enabled === false) return;

                event.preventDefault();

                switch (event.touches.length) {

                    case 1:	// one-fingered touch: rotate

                        if (scope.enableRotate === false) return;

                        handleTouchStartRotate(event);

                        state = STATE.TOUCH_ROTATE;

                        break;

                    case 2:	// two-fingered touch: dolly-pan

                        if (scope.enableZoom === false && scope.enablePan === false) return;

                        handleTouchStartDollyPan(event);

                        state = STATE.TOUCH_DOLLY_PAN;

                        break;

                    default:

                        state = STATE.NONE;

                }

                if (state !== STATE.NONE) {

                    scope.dispatchEvent(startEvent);

                }

            }

            function onTouchMove(event) {

                if (scope.enabled === false) return;

                event.preventDefault();
                event.stopPropagation();

                switch (event.touches.length) {

                    case 1: // one-fingered touch: rotate

                        if (scope.enableRotate === false) return;
                        if (state !== STATE.TOUCH_ROTATE) return; // is this needed?

                        handleTouchMoveRotate(event);

                        break;

                    case 2: // two-fingered touch: dolly-pan

                        if (scope.enableZoom === false && scope.enablePan === false) return;
                        if (state !== STATE.TOUCH_DOLLY_PAN) return; // is this needed?

                        handleTouchMoveDollyPan(event);

                        break;

                    default:

                        state = STATE.NONE;

                }

            }

            function onTouchEnd(event) {

                if (scope.enabled === false) return;

                handleTouchEnd(event);

                scope.dispatchEvent(endEvent);

                state = STATE.NONE;

            }

            function onContextMenu(event) {

                if (scope.enabled === false) return;

                event.preventDefault();

            }

            //添加事件监听器

            scope.domElement.addEventListener('contextmenu', onContextMenu, false);

            scope.domElement.addEventListener('mousedown', onMouseDown, false);
            scope.domElement.addEventListener('wheel', onMouseWheel, false);

            scope.domElement.addEventListener('touchstart', onTouchStart, false);
            scope.domElement.addEventListener('touchend', onTouchEnd, false);
            scope.domElement.addEventListener('touchmove', onTouchMove, false);

            window.addEventListener('keydown', onKeyDown, false);

            // force an update at start（在刚开始时强制更新）

            this.update();

        };

//覆写原型
        THREE.OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
//修改原型的构造函数指向为指向自身
        THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

//给原型添加某些属性
        Object.defineProperties(THREE.OrbitControls.prototype, {

            center: {
                get: function () {

                    console.warn('THREE.OrbitControls: .center has been renamed to .target');
                    return this.target;

                }

            },

            // backward compatibility

            noZoom: {

                get: function () {

                    console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
                    return !this.enableZoom;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
                    this.enableZoom = !value;

                }

            },

            noRotate: {

                get: function () {

                    console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
                    return !this.enableRotate;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
                    this.enableRotate = !value;

                }

            },

            noPan: {

                get: function () {

                    console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
                    return !this.enablePan;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
                    this.enablePan = !value;

                }

            },

            noKeys: {

                get: function () {

                    console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
                    return !this.enableKeys;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
                    this.enableKeys = !value;

                }

            },

            staticMoving: {

                get: function () {

                    console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
                    return !this.enableDamping;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
                    this.enableDamping = !value;

                }

            },

            dynamicDampingFactor: {

                get: function () {

                    console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
                    return this.dampingFactor;

                },

                set: function (value) {

                    console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
                    this.dampingFactor = value;

                }

            }

        });

        return THREE;
    }

    class ThreeJSController {
        constructor() {
            this.renderer = null;
            this.camera = null;
            this.scene = null;
            this.model = null;
            this.init = this.init.bind(this);
            this.addModel = this.addModel.bind(this);
            this.updateCamera = this.updateCamera.bind(this);
            this.updateModelPosition = this.updateModelPosition.bind(this);
            this.render = this.render.bind(this);
        }

        //初始化Three.js的必要组件
        init() {
            this.renderer = new THREE.WebGLRenderer();
            this.renderer.setSize(defaultWidth, defaultHeight);
            this.renderer.setClearColor(0xffffff, 1);
            this.camera = new THREE.PerspectiveCamera();
            // this.camera.matrixAutoUpdate = false;
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

        setThreeCameraProps(props) {
            for (let i in props) {
                this.camera[i] = props[i];
            }
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

    class Controller {
        constructor() {
            this.outputCanvas = null;
            this.threeController = new ThreeJSController();
        }

        init() {
            //创建输出上下文
            let canvas = document.createElement('canvas');
            canvas.width = defaultWidth;
            canvas.height = defaultHeight;
            this.outputCanvas = canvas;
        }
    }

    class ImageController extends Controller {
        constructor() {
            super();
            this.model = null;
            this.posit = null;
            this.threeController = new ThreeJSController();
            this.init = this.init.bind(this);
            this.createModel = this.createModel.bind(this);
            this.locateModel = this.locateModel.bind(this);
        }

        init() {
            //创建输出上下文
            let canvas = document.createElement('canvas');
            canvas.width = defaultWidth;
            canvas.height = defaultHeight;
            this.outputCanvas = canvas;

            let threeController = this.threeController;
            threeController.init();
            let camera = threeController.camera;
            let scene = threeController.scene;
            threeController.setThreeCameraProps({
                fov: 40,
                aspect: window.innerWidth / window.innerHeight,
                near: 1,
                far: 1000
            });
            threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
            camera.lookAt(scene.position);
        }

        //创建模型
        createModel() {
            let object = new THREE.Object3D(),
                geometry = new THREE.SphereGeometry(0.5, 15, 15, Math.PI),
                loader = new THREE.TextureLoader();
            loader.load("./js/textures/earth.jpg", function (texture) {
                let material = new THREE.MeshBasicMaterial({map: texture});
                let mesh = new THREE.Mesh(geometry, material);
                object.add(mesh);
            });
            //场景添加模型，实际添加以地图图像为贴图的球体
            this.model = object;
            this.threeController.addModel(this.model);
        }

        //定位模型
        locateModel(position, modelSize) {
            if (!this.model) {
                this.createModel();
            }
            let markers = [{corners: position}];
            let corners, corner, pose, i;

            let size = this.threeController.renderer.getSize();

            if (markers.length > 0) {
                corners = markers[0].corners;

                for (i = 0; i < corners.length; ++i) {
                    corner = corners[i];

                    corner.x = corner.x - (size.width / 2);
                    corner.y = (size.height / 2) - corner.y;
                }

                if (!this.posit) {
                    alert('pose algorithm is not defined');
                    return;
                }
                //根据目标图像四个角点的位置计算出相机的当前姿态
                pose = this.posit.pose(corners);

                //更新模型的姿态
                // updateObject(model, pose.bestRotation, pose.bestTranslation);
                this.threeController.updateModel(modelSize, pose.bestRotation, pose.bestTranslation);
            }
        }
    }

    class RealWorldController extends ThreeJSController {
        constructor() {
            super();
            this.model = null;
            this.init = this.init.bind(this);
            this.update = this.update.bind(this);
            this.createTexture = this.createTexture.bind(this);
            this.render = this.render.bind(this);
        }

        //初始化环境组件
        init(material) {
            this.renderer = new THREE.WebGLRenderer();
            this.renderer.setSize(defaultWidth, defaultHeight);
            this.renderer.setClearColor(0xffffff, 1);
            this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5);
            this.scene = new THREE.Scene();
            this.scene.add(this.camera);

            this.model = this.createTexture(material);
            this.scene.add(this.model);
        }

        //更新渲染内容
        update() {
            this.model.children[0].material.map.needsUpdate = true;
        }

        //创建纹理，以视频流为颜色映射对象
        createTexture(video) {
            //THREE.Texture():创建一个纹理应用到一个表面或作为反射或折射贴图
            var texture = new THREE.Texture(video),
                object = new THREE.Object3D(),
                geometry = new THREE.PlaneGeometry(1.0, 1.0, 0.0),
                //map:颜色映射，默认为空
                material = new THREE.MeshBasicMaterial({map: texture, depthTest: false, depthWrite: false}),
                mesh = new THREE.Mesh(geometry, material);
            texture.minFilter = THREE.LinearFilter;
            object.position.z = -1;

            object.add(mesh);

            return object;
        }
    }

    class OrbitController extends ThreeJSController {
        constructor() {
            super();
            this.model = null;
            this.posit = null;
            this.threeController = new ThreeJSController();
            this.orbitControls = null;

        }

        init(model) {
            let threeController = this.threeController;
            threeController.init();
            let camera = threeController.camera;
            let scene = threeController.scene;
            threeController.setThreeCameraProps({
                fov: 40,
                aspect: window.innerWidth / window.innerHeight,
                near: 1,
                far: 1000
            });
            threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
            camera.lookAt(scene.position);

            if (!model) {
                //添加模型
                threeController.addModel(createCube(10, 10, 10));
            } else {
                threeController.addModel(model);
            }
            threeController.updateModelPosition({x: 0, y: 0, z: -100});
        }

        control() {
            this.orbitControls = new orbitController(this.threeController.camera, this.threeController.renderer.domElement)
        }
    }


    class OrientationController extends Controller {
        constructor() {
            super();
            this.threeController = new ThreeJSController();
        }

        init(model) {
            let threeController = this.threeController;
            threeController.init();
            let camera = threeController.camera;
            let scene = threeController.scene;
            threeController.setThreeCameraProps({
                fov: 40,
                aspect: window.innerWidth / window.innerHeight,
                near: 1,
                far: 1000,
                up: {
                    x: 0,
                    y: 1,
                    z: 0
                }
            });
            threeController.updateCamera({position: {x: 0, y: 0, z: 100}});
            camera.lookAt(scene.position);

            if (!model) {
                //添加模型
                threeController.addModel(createCube(10, 10, 10));
            } else {
                threeController.addModel(model);
            }
        }

        control() {
            let model = this.threeController.model;
            window.addEventListener('deviceorientation', function (event) {
                //重力感应事件处理
                var alpha = event.alpha / 180 * Math.PI;
                var beta = event.beta / 180 * Math.PI;
                var gamma = event.gamma / 180 * Math.PI;

                //反转
                var matrix = model.matrix.clone();
                matrix.getInverse(matrix);
                model.applyMatrix(matrix);


                //欧拉角顺序应该为ZXY，另外需要注意的是前边参数的顺序和后边设置的顺序不是一一对应的，也就是说就算顺序被设置为ZXY，前边三个参数的顺序依然XYZ
                var euler = new THREE.Euler();
                euler.set(beta, gamma, alpha, 'ZXY');
                model.setRotationFromEuler(euler);
            }, false);
        }

    }

    class ImageOrbitController extends ImageController {
        constructor() {
            super();
        }

        init(model) {
            super.init.call(this);
            let threeController = this.threeController;
            threeController.init();

            let camera = threeController.camera;
            let scene = threeController.scene;
            threeController.setThreeCameraProps({
                fov: 40,
                aspect: window.innerWidth / window.innerHeight,
                near: 1,
                far: 1000
            });
            threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
            camera.lookAt(scene.position);
        }

        control(response) {
            let threeController = this.threeController;
            document.addEventListener('mouseup', handler, false);

            function handler() {
                threeController.updateCamera({position: {x: 0, y: 0, z: 10}});
                threeController.camera.lookAt(threeController.scene.position);
                document.removeEventListener('mouseup', handler, false);
                response()
            }

            this.orbitControls = new orbitController(this.threeController.camera, this.threeController.renderer.domElement)
        }


    }


    return {
        ThreeJSController: ThreeJSController,
        ImageController: ImageController,
        OrbitController: OrbitController,
        RealWorldController: RealWorldController,
        OrientationController: OrientationController,
        ImageOrbitController: ImageOrbitController,
    }
});


