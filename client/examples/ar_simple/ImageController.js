require.config({
    paths: {
        io: '../../js/libs/socket.io/socket.io',
        // posit: '../../js/libs/posit',
        eventHandlerBase: './eventHandlerBase',
    }
});
define(['io'], function (io) {

    let defaultWidth = window.innerWidth;
    let defaultHeight = window.innerHeight;

    //图像识别定位
    class Recognizer {
        constructor(video) {
            this.socket = null;
            this.serverPath = 'https://10.28.201.198:8081';
            this.timer = null;
            this.canvas = document.createElement('canvas');
            this.corners = null;
            this.video = video;
            this.start()
            this.stop = this.stop.bind(this)

        }

        start(socket) {
            let default_video_period = 100;
            let video_period = 100;
            let _self = this;
            if (!socket) {
                //连接服务器端，传输数据
                socket = io.connect(this.serverPath);
                socket.on('frame', function (data) {
                    let corners = data.corners;
                    if (!corners) return;
                    _self.corners = corners;
                });
            }

            //定时向后端传输图像数据
            this.timer = setInterval(function () {
                sendVideoData(socket, _self.video);
            }, video_period || default_video_period);

            //发送视频帧
            function sendVideoData(socket, video) {
                let width = video.videoWidth;
                let height = video.videoHeight;
                _self.canvas.width = video.videoWidth;
                _self.canvas.height = video.videoHeight;

                let context = _self.canvas.getContext('2d');

                //绘制当前视频帧
                context.drawImage(video, 0, 0, width, height, 0, 0, width, height);

                let jpgQuality = 0.6;
                let theDataURL = _self.canvas.toDataURL('image/jpeg', jpgQuality);//转换成base64编码
                let data = {
                    imgData: theDataURL,
                };
                //使用websocket进行图像传输
                socket.emit('VIDEO_MESS', JSON.stringify(data));
            }
        }

        //停止图像识别
        stop() {
            if (!this.timer) return;
            clearInterval(this.timer);
            this.timer = null;
        }

    }

    class ImageController {
        constructor(sessionEls, renderer, scene, camera, model, video, modelSize) {
            // 绘制视频帧
            this.sessionEls = sessionEls;
            this.canvas = document.createElement('canvas');

            //three.js
            this.scene = scene;
            this.camera = camera;
            this.camera.position.x = 0;
            this.camera.position.y = 0;
            this.camera.position.z = 10;
            camera.lookAt(scene.position);
            this.renderer = renderer;
            this.model = model;
            this.modelSize = modelSize;
            this.prePos = null;

            this.posit = new POS.Posit(modelSize, Math.max(defaultWidth, defaultHeight));
            this.video = video;

            this.onFrame = this.onFrame.bind(this);
            this.init();
        }

        init() {
            this.recognizer = new Recognizer(this.video);
        }

        setRendererProps(props) {
            for (let i in props) {
                this.renderer[i] = props[i];
            }
        }

        setCameraProps(props) {
            for (let i in props) {
                this.camera[i] = props[i];
            }
        }

        update() {
            this.renderer.setSize(this.video.videoWidth, this.video.videoHeight);
            let curposition = recognitionCenter.corners;
            if (curposition && this.preposition !== curposition) {
                this.locateModel(curposition);
                this.preposition = curposition;
            }

        }


        //定位模型
        locateModel(position) {
            if (!this.model) {
                return
            }
            let markers = [{corners: position}];
            let corners, corner, pose, i;

            let size = this.renderer.getSize();

            if (markers.length > 0) {
                corners = markers[0].corners;

                for (i = 0; i < corners.length; ++i) {
                    corner = corners[i];

                    corner.x = corner.x - (size.width / 2);
                    corner.y = (size.height / 2) - corner.y;
                }

                //根据目标图像四个角点的位置计算出相机的当前姿态
                pose = this.posit.pose(corners);

                //更新模型的姿态
                // updateObject(model, pose.bestRotation, pose.bestTranslation);
                this.updateModel(this.modelSize, pose.bestRotation, pose.bestTranslation);
            }
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

        onFrame() {
            requestAnimationFrame(this.onFrame);
            this.update();
            // this.renderer.autoClear = false;
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);

        }
    }

    return ImageController;

})
