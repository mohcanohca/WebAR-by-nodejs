function getMediaDevice(constraints) {
    //用来适配旧版的浏览器
    var promisifiedOldGUM = function(constraints) {
        // 进行能力检测
        // First get ahold of getUserMedia, if present
        var getUserMedia = (navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia);

        // 有些浏览器没有实现getUserMedia，返回一个reject状态的Promise
        // Some browsers just don't implement it - return a rejected promise with an error
        // to keep a consistent interface
        if(!getUserMedia) {
            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        // 否则，使用Promise包装过去的navigator.getUserMedia用法
        // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
        return new Promise(function(resolve, reject) {
            getUserMedia.call(navigator, constraints, resolve, reject);
        });

    };

    // 老版本的浏览器可能没有实现mediaDevices，先将其设置为一个空对象
    if(navigator.mediaDevices === undefined) {
        navigator.mediaDevices = {};
    }

    /*     一些浏览器部分实现了mediaDevices。我们不能只用getUserMedia指定一个对象，
     因为getUserMedia会覆盖现有的属性。
     如果getUserMedia丢失，只添加getUserMedia属性*/
    if(navigator.mediaDevices.getUserMedia === undefined) {
        navigator.mediaDevices.getUserMedia = promisifiedOldGUM;
    }
}

//地理位置信息
;(function () {
    var startPos;

    //设置参数，减少启动地理定位硬件的必要性
    var geoOptions={
        maximumAge:5*60*1000,//使用最近获取的地理定位结果，不仅能更快返回数据，还能防止浏览器启动其地理定位硬件接口，例如WiFi三角测量或GPS
        timeout:10*1000,//设置超时，超出该范围时返回错误
//            enableHighAccuracy:true,//设置需要高精度数据。优先采用粗略位置，该选项会导致解析速度下降，电池耗电增加

    };

    //成功获取地理位置信息
    var geoSuccess=function (position) {
        startPos=position;
//            console.log(startPos);
/*        document.getElementById('startLat').innerHTML=startPos.coords.latitude;//维度
        document.getElementById('startLon').innerHTML=startPos.coords.longitude;//经度*/
        EventManager.trigger('position',position);

    };

    //处理错误
    var geoError=function (error) {
        console.log('Error occurred. Error code: ' + error.code);
        // error.code can be:
        //   0: unknown error
        //   1: permission denied
        //   2: position unavailable (error response from location provider)
        //   3: timed out
    };

    //检测浏览器是否支持
    if(navigator.geolocation){

        //getCurrentPosition()以异步方式报告用户当前位置
        navigator.geolocation.getCurrentPosition(geoSuccess,geoError);

        //监测用户位置
        navigator.geolocation.watchPosition(function (pos) {
            /*document.getElementById('curLat').innerHTML=pos.coords.latitude;//维度
            document.getElementById('curLon').innerHTML=pos.coords.longitude;//维度
            console.log('current:');
            console.log(pos);*/
            EventManager.trigger('position',pos);
        },geoError,geoOptions);
    }else{
        console.log('Geolocation is not supported for this Browser/OS.');
    }
})();

//方向信息
(function () {
    function handleOrientation(event) {
        var orientationInfo={
            x:event.beta,
            y:event.gamma,
            z:event.alpha
        };
        EventManager.trigger('deviceOrientation',orientationInfo);
    }

    function handleMotion(deviceMotionEvent) {
        EventManager.trigger('deviceMotion',deviceMotionEvent);
    }

    window.addEventListener("deviceorientation", handleOrientation, true);
/*    window.addEventListener("deviceorientation", function (event) {
        console.log(event);
    }, true);*/
    window.addEventListener("deviceMotion", handleMotion, true);
})();

//打开摄像头和麦克风
(function () {
    // 设置参数。同时打开摄像头和麦克风，并将相机的分辨率设置为1280x720
    // var constraints = { audio: true, video: { width: 1280, height: 720 } };

    //设置帧率
    // var constraints = { video: { frameRate: { ideal: 10, max: 15 } } };

    //设置前置或后置摄像头，只适用于移动设备上
    var front = false;
    // document.getElementById('flip-button').onclick = function() { front = !front; };

    var constraints = { video: { facingMode: (front? "user" : "environment") } };//若在PC上使用时也不会报错

    getMediaDevice(constraints);
    navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream) {
            var cameraInfo={
                stream:stream,
                facingMode:constraints.video.facingMode
            };
            EventManager.trigger('camera',cameraInfo);

        })
        .catch(function(err) {
            console.log(err.name + ": " + err.message);
        });
})();

(function () {
    EventManager.listen('camera',function (cameraInfo) {
        if(cameraInfo.facingMode=='user'){
            var videoWrap=document.createElement('div');
            document.body.appendChild(videoWrap);
            videoWrap.className='videoWrap';

            var video= document.createElement("video");
            video.setAttribute('autoplay','true');
            video.setAttribute('id','camera-user');
            video.src=window.URL.createObjectURL(cameraInfo.stream);
            // video.innerHTML='js添加';
            videoWrap.appendChild(video);

            video.className='video';

            video.onloadedmetadata = function(e) {
                video.play();
            };
        }

    });

    //订阅摄像头获取的视频流
    EventManager.listen('camera',function (cameraInfo) {
        if(cameraInfo.facingMode=='environment'){
            var videoWrap=document.createElement('div');
            document.body.appendChild(videoWrap);
            videoWrap.className='videoWrap';

            var video= document.createElement("video");
            video.setAttribute('autoplay','true');
            video.setAttribute('id','camera-environment');
            video.src=window.URL.createObjectURL(cameraInfo.stream);
            // video.innerHTML='js添加';
            videoWrap.appendChild(video);

            video.className='video';

            video.onloadedmetadata = function(e) {
                video.play();
            };
        }

    });

    EventManager.listen('microphone',function (microphoneInfo) {

    });

    EventManager.listen('position',function (pos) {
        document.getElementById('curLat').innerHTML=pos.coords.latitude;//维度
        document.getElementById('curLon').innerHTML=pos.coords.longitude;//维度
    });

    EventManager.listen('deviceOrientation',function (deviceMotionEvent) {
        console.log('deviceOrientation changed');
    });
    EventManager.listen('deviceMotion',function (deviceMotionEvent) {

    });
})();



