require.config({
    paths: {
        io: '../libs/socket.io/socket.io',
        eventManager: './event',
        mediaDevices: './webrtc',
        ControlCenter: './ControlCenter'
    }
});

require(['io', 'eventManager', 'mediaDevices', 'ControlCenter'], function (io, eventManager, mediaDevices, ControlCenter) {

    eventManager.listen('changeControl', handleChangeControl);

    eventManager.listen('imageControl', handleImageControl)
    eventManager.listen('orbitControl', handleOrbitControl)
    eventManager.listen('imageOrbitControl', handleImageOrbitControl)
    eventManager.listen('orientationControl', handleOrientationControl)
    eventManager.listen('audioControl', handleAudioControl)

    let currentController = 'imageControl';

    function handleChangeControl(type) {
        eventManager.remove('changeControl');//移除对于changeControl监听，稍后重新添加监听


        currentController = type;
        ControlCenter.reset(type);

        eventManager.trigger(type);
        eventManager.listen('changeControl', handleChangeControl);
    }

    let controllers = document.getElementById('controllers');

    let video;//存放视频流的DOM元素

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

    //语音控制
    function handleAudioControl() {
        console.log('语音控制')
        ControlCenter.audioControl();
    }
});

