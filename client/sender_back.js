(function () {
    window.addEventListener("deviceorientation", handleOrientation, true);
    window.addEventListener("deviceMotion", handleMotion, true);
    let deviceOrientation={
        thetax:0,
        thetay:0,
        thetaz:0
    };
    let devicePosition={
        x:0,
        y:0,
        x:0
    }
    function handleOrientation(event) {
        deviceOrientation.thetax=event.beta;
        deviceOrientation.thetay=event.gamma;
        deviceOrientation.thetaz=event.alpha;
    }
    function handleMotion(event) {
        console.log(event);
    }
    var canvas = document.getElementById('canvas');
    /*    var width = 640;
        var height = 480;*/
    /*    width=document.documentElement.clientWidth;
        height=document.documentElement.clientHeight;*/


    function takepicture(video) {
        return function () {
            if (width && height) {
                canvas.width = width;
                canvas.height = height;
                let context = canvas.getContext('2d');
                canvasFace.width = width;
                canvasFace.height = height;

                context.drawImage(video, 0, 0, width, height, 0, 0, width, height);

                //
                let jpgQuality = 0.6;
                let theDataURL = canvas.toDataURL('image/jpeg', jpgQuality);

                socket.emit('img', theDataURL);
                // alert(socket)
            }
        }
    }


    //用来适配旧版的浏览器
    const promisifiedOldGUM = function (constraints) {
        // 进行能力检测
        // First get ahold of getUserMedia, if present
        let getUserMedia = (navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia);

        // 有些浏览器没有实现getUserMedia，返回一个reject状态的Promise
        // Some browsers just don't implement it - return a rejected promise with an error
        // to keep a consistent interface
        if (!getUserMedia) {
            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        // 否则，使用Promise包装过去的navigator.getUserMedia用法
        // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
        return new Promise(function (resolve, reject) {
            getUserMedia.call(navigator, constraints, resolve, reject);
        });

    }

    // 老版本的浏览器可能没有实现mediaDevices，先将其设置为一个空对象
    if (navigator.mediaDevices === undefined) {
        navigator.mediaDevices = {};
    }

    /*     一些浏览器部分实现了mediaDevices。我们不能只用getUserMedia指定一个对象，
         因为getUserMedia会覆盖现有的属性。
         如果getUserMedia丢失，只添加getUserMedia属性*/
    if (navigator.mediaDevices.getUserMedia === undefined) {
        navigator.mediaDevices.getUserMedia = promisifiedOldGUM;
    }


    let cameraDeviceIds = [];
    navigator.mediaDevices.enumerateDevices().then(gotDevices);
    transferData();

    //TODO 将IMU信息融入
    function transferData() {

        transferPic();
    }

    function gotDevices(mediaDevices) {
        mediaDevices.forEach(mediaDevice => {
            if (mediaDevice.kind === 'videoinput') {
                // const option = document.createElement('option');
                cameraDeviceIds.push(mediaDevice.deviceId);
                // const label = mediaDevice.label || `Camera ${count++}`;
                // const textNode = document.createTextNode(label);
                // option.appendChild(textNode);
                // select.appendChild(option);
            }
        });

    }

    function transferPic() {
        let videoConstraints = {
            width:360,
            height:480,
            deviceId: cameraDeviceIds[1]
        };

        let constraints = {video: videoConstraints};//若在PC上使用时也不会报错

        navigator.mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
                var video = document.getElementById('video');
                // 旧的浏览器可能没有srcObject
                if ("srcObject" in video) {
                    video.srcObject = stream;
                } else {
                    // 防止再新的浏览器里使用它，应为它已经不再支持了
                    video.src = window.URL.createObjectURL(stream);
                }
                video.onloadedmetadata = function (e) {
                    video.play();
                    console.log(video.videoWidth)
                    width = video.videoWidth;
                    height = video.videoHeight;
                    setInterval(takepicture(video), 1000 / 10)
                };

            })
            .catch(function (err) {
                // alert("error");
                alert(err.name + ": " + err.message);
            });
    }
})();