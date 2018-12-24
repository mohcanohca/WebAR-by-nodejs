require.config({
    paths: {
        io: '../libs/socket.io/socket.io',
        eventManager: '../utils/event',
        mediaDevices: '../utils/webrtc',
        ControlCenter: './ControlCenter'
    }
});

require(['io', 'eventManager', 'mediaDevices', 'ControlCenter'], function (io, eventManager, mediaDevices, ControlCenter) {

    eventManager.listen('changeControl', handleChangeControl);

    eventManager.listen('imageControl', handleImageControl)
    eventManager.listen('orbitControl', handleOrbitControl)
    eventManager.listen('imageOrbitControl', handleImageOrbitControl)
    eventManager.listen('orientationControl', handleOrientationControl)
    eventManager.listen('imageOrientationControl', handleImageOrientationControl)
    eventManager.listen('audioControl', handleAudioControl)
    eventManager.listen('GPSControl', handleGPSControl)

    let curController = null;

    function handleChangeControl(type) {
        eventManager.remove('changeControl');//移除对于changeControl监听，稍后重新添加监听
        if (curController) {
            ControlCenter.resetControl(curController);
        }
        curController = type;
        eventManager.trigger(type);//触发控制
        eventManager.listen('changeControl', handleChangeControl);
    }

    let controllers = document.getElementById('controllers');

    controllers.addEventListener('click', function (e) {
        let controllerID = e.target.id;
        if (controllerID) {
            eventManager.trigger('changeControl', controllerID);
        }
    }, false);


    //图像识别交互控制
    function handleImageControl() {
        console.log('图像识别交互控制');
        ControlCenter.imageControl();
    }

    //触摸屏、键盘、鼠标控制
    function handleOrbitControl() {
        console.log('触摸屏、键盘、鼠标控制')
        ControlCenter.orbitControl();
    }

    function handleImageOrbitControl() {
        console.log('图像识别与手动混合控制')
        /*handleImageControl();
        handleOrbitControl();*/
        ControlCenter.imageOrbitControl();
    }

    //传感器控制
    function handleOrientationControl() {
        console.log('传感器控制')
        ControlCenter.orientationControl();
    }

    //识别+传感器
    function handleImageOrientationControl() {
        console.log('识别+传感器控制')
        ControlCenter.imageOrientationControl();
    }

    //语音控制
    function handleAudioControl() {
        console.log('语音控制')
        // ControlCenter.audioControl();
    }

    function handleGPSControl() {
        console.log('地理位置信息控制')
        ControlCenter.GPSControl();
    }
});

