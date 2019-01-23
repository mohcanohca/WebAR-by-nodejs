/**
 * @author richt / http://richt.me
 * @author WestLangley / http://github.com/WestLangley
 *
 * W3C Device Orientation control (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
 */

THREE.DeviceOrientationControls = function (object) {

    var scope = this;

    this.object = object;
    this.object.rotation.reorder('YXZ');

    this.enabled = true;

    this.deviceOrientation = {};
    this.screenOrientation = 0;

    this.alphaOffset = 0; // radians

    var onDeviceOrientationChangeEvent = function (event) {

        scope.deviceOrientation = event;

    };

    var onScreenOrientationChangeEvent = function () {

        scope.screenOrientation = window.orientation || 0;

    };

    // The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''

    var setObjectQuaternion = function () {

        var zee = new THREE.Vector3(0, 0, 1);

        //Euler就是欧拉角，简单来说欧拉角的基本思想就是任何角位移都可以分解为绕三个互相垂直的轴的三个旋转组成，任意三个轴和任意顺序都可以，但最有意义的是使用笛卡尔坐标系（旋转物体自身的坐标系，而不是世界坐标系）并按一定顺序所组成的旋转序列；
        var euler = new THREE.Euler();

        var q0 = new THREE.Quaternion();

        //Quaternion( x : Float, y : Float, z : Float, w : Float )
        var q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around the x-axis 绕x轴旋转-90°

        return function (quaternion, alpha, beta, gamma, orient) {

            //set(x,y,z,order)按照x，y，z，order设置旋转弧度
            euler.set(beta, alpha, -gamma, 'YXZ'); // 'ZXY' for the device, but 'YXZ' for us

            quaternion.setFromEuler(euler); // orient the device 定设备方向

            quaternion.multiply(q1); // camera looks out the back of the device, not the top 摄像头从设备的背面看出去，而不是从顶部看出去

            quaternion.multiply(q0.setFromAxisAngle(zee, -orient)); // adjust for screen orientation 调整屏幕方向

        };

    }();

    //添加事件监听
    this.connect = function () {

        onScreenOrientationChangeEvent(); // run once on load

        window.addEventListener('orientationchange', onScreenOrientationChangeEvent, false);
        window.addEventListener('deviceorientation', onDeviceOrientationChangeEvent, false);

        scope.enabled = true;

    };

    //移除事件监听，将DeviceOrientationControls设为无效
    this.disconnect = function () {

        window.removeEventListener('orientationchange', onScreenOrientationChangeEvent, false);
        window.removeEventListener('deviceorientation', onDeviceOrientationChangeEvent, false);

        scope.enabled = false;

    };

    //物体状态更新
    this.update = function () {

        if (scope.enabled === false) return;

        var device = scope.deviceOrientation;

        if (device) {//若存在deviceOrientation
            //degToRad:将度数转换为弧度。
            var alpha = device.alpha ? THREE.Math.degToRad(device.alpha) + scope.alphaOffset : 0; // Z

            var beta = device.beta ? THREE.Math.degToRad(device.beta) : 0; // X'

            var gamma = device.gamma ? THREE.Math.degToRad(device.gamma) : 0; // Y''

            var orient = scope.screenOrientation ? THREE.Math.degToRad(scope.screenOrientation) : 0; // O

            setObjectQuaternion(scope.object.quaternion, alpha, beta, gamma, orient);

        }


    };

    //移除deviceorientation事件监听
    this.dispose = function () {

        scope.disconnect();

    };

    this.connect();

};
