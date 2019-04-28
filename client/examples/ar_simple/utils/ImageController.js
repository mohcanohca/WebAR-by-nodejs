require.config({
    // baseUrl: '/examples/ar_simple',
    paths: {
        eventHandlerBase: 'utils/eventHandlerBase',
        io: 'libs/socket.io/socket.io',
        CV: 'libs/cv',
        jsfeat: 'libs/jsfeat',
        FeatTrainer: 'utils/FeatTrainer',
        svd: 'libs/svd',
        POS: 'libs/posit',
        // jquery: 'libs/jquery-3.3.1.min'
    },
    shim: {
        jsfeat: {exports: 'jsfeat'},
        FeatTrainer: {exports: 'FeatTrainer'},
        CV: {exports: 'CV'},
        svd: {exports: 'svd'},
        POS: {exports: 'POS'},
        // jquery: {exports: '$'}

    }
});

define(['eventHandlerBase', 'io', 'CV', 'jsfeat', 'FeatTrainer', 'svd', 'POS',], function (EventHandlerBase, io, CV, jsfeat, featTrainer, svd, POS) {
    let defaultWidth = window.innerWidth;
    let defaultHeight = window.innerHeight;

    function warp_perspective_zp(src, dst, transform) {
        var td = transform.data;
        var m00 = td[0], m01 = td[1], m02 = td[2],
            m10 = td[3], m11 = td[4], m12 = td[5],
            m20 = td[6], m21 = td[7], m22 = td[8];

        for (var i = 0; i < 4; i++) {
            var ws = m20 * src[i][0] + m21 * src[i][1] + m22;
            dst[i][0] = (m00 * src[i][0] + m01 * src[i][1]
                + m02) / ws;
            dst[i][1] = (m10 * src[i][0] + m11 * src[i][1]
                + m12) / ws;
        }
    }

    //图像识别定位
    class ServerRecognizer extends EventHandlerBase {
        constructor({video, canvas, serverPath, protocol, requestMark, receiveMark, period}) {
            super();
            this.socket = null;
            this.serverPath = serverPath;
            this.protocol = protocol;
            this.period = period;
            this.timer = null;
            this.canvas = canvas;
            this.corners = null;
            this.video = video;
            this.connected = false;
            this.requestMark = requestMark;
            this.receiveMark = receiveMark;
            this.recognize = this.recognize.bind(this);
            // this._sendFrame = this._sendFrame.bind(this);
            this._start();
            this.stop = this.stop.bind(this);

            //创建用于绘制图像识别结果的canvas
            /*let cornsCanvas = document.createElement('canvas');
            cornsCanvas.setAttribute('id', 'corns');
            document.body.appendChild(cornsCanvas);
            cornsCanvas.width = window.innerWidth;
            cornsCanvas.height = window.innerHeight;
            this.cornsCanvas = cornsCanvas;*/
        }

        _handleFrameCorners(data) {
            // console.log('receive:' + (new Date()).getTime())
            let corners = data.corners;
            if (!corners) return;

            //绘制图像识别结果
            /*            let canvas = this.cornsCanvas;
                        let context = canvas.getContext('2d');
                        context.clearRect(0, 0, canvas.width, canvas.height);
                        context.beginPath();
                        context.moveTo(corners[0].x, corners[0].y);//起点
                        context.lineTo(corners[1].x, corners[1].y);//终点
                        context.lineTo(corners[2].x, corners[2].y);//终点
                        context.lineTo(corners[3].x, corners[3].y);//终点
                        context.closePath();
                        context.lineWidth = 3;//设置线条宽度
                        context.strokeStyle = "red";//设置线条的效果，类似于CSS，需要用“”，以字符串的形式
                        // context.fillStyle = "pink";//设置填充样式
                        // context.fill();//填充动作
            
                        context.stroke();//绘制*/
            this.corners = corners;
        }

        // 开始图像识别
        _start() {
            let default_video_period = 40;
            let video_period = this.period || default_video_period;
            let _self = this;
            if (this.protocol === 'ws') {
                //若是采用websoc通信协议
                if (!this.socket) {
                    //连接服务器端，传输数据
                    this.socket = io.connect(this.serverPath);
                    this.socket.on('connect', function () {
                        _self.connected = true;
                    });
                    this.socket.on(this.receiveMark, this._handleFrameCorners.bind(this));
                }
            }


            /**
             *
             * 使用requestAnimationFrame的16.7ms的帧率请求图像识别结果
             * 使用该频率请求服务器端压力过大，处理不及时，导致识别结果与图像位置存在延迟，可根据服务器端处理能力选择
             */
            //定时向后端传输图像数据
            this.timer = setInterval(function () {
                //发送视频帧
                if (_self.protocol === 'ws' && _self.connected) {
                    let imgData = _self._drawImage();

                    let data = {
                        imgData: imgData,
                    };
                    // console.log('emit VIDEO_MESS:' + (new Date()).getTime())
                    //使用websocket进行图像传输
                    _self.socket.emit(_self.requestMark, JSON.stringify(data));
                } else {
                    //通过ajax发送数据
                    //在收到响应后调用this.handleFrameCorners
                    /*$.ajax({
                        url: _self.serverPath,
                        dataType: 'jsonp',
                        success: function (data) {
                            _self.handleFrameCorners(data.data);
                        }
                    });*/
                }

            }, video_period);

        }

        //绘制图像
        _drawImage() {
            let video = this.video;
            let videoWidth = video.videoWidth;
            let videoHeight = video.videoHeight;

            let width = this.canvas.width;
            let height = this.canvas.height;

            let context = this.canvas.getContext('2d');

            let startPosX = Math.floor((videoWidth - width) / 2);
            let startPosY = Math.floor((videoHeight - height) / 2);

            //绘制当前视频帧
            context.drawImage(video, startPosX, startPosY, width, height, 0, 0, width, height);

            let jpgQuality = 0.6;
            let imageDataURL = this.canvas.toDataURL('image/jpeg', jpgQuality);//转换成base64编码
            return imageDataURL;
        }

        /**
         * 为与FrontRecognizer的recognize方法保持一致
         */
        recognize() {

        }

        //停止图像识别
        stop() {
            if (!this.timer) return;
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    class FrontRecognizer {
        constructor({video, canvas, patternImg}) {
            this.timer = null;
            this.canvas = canvas;
            this.corners = null;
            this.video = video;
            this.patternImg = patternImg;
            this.pattern_features = null;
            this.pattern_pos = []; //模板图上选取的四个点（此处为图像的四个角点）
            this.frame_pos = [];//模板图在当前帧中四个点的位置
            this.featTrainer = new FeatTrainer();
            this.screen_features = null;

            this._train();
            this.recognize = this.recognize.bind(this);
            this._describeFrame = this._describeFrame.bind(this);
            this._match = this._match.bind(this);
        }

        //训练模板图
        _train() {
            // 模板图四个角点
            this.pattern_pos = [[0, 0], [this.patternImg.width, 0], [this.patternImg.width, this.patternImg.height], [0, this.patternImg.height]];

            this.frame_pos = [[0, 0], [0, 0], [0, 0], [0, 0]];

            //灰度处理
            let pattern_img_u8 = this.featTrainer.getGrayScaleMat(this.patternImg);

            //获取到训练好的数据
            this.pattern_features = this.featTrainer.trainPattern(pattern_img_u8);
        }

        // 描述当前视频帧，得到当前帧的特征点
        _describeFrame() {
            let videoWidth = this.video.videoWidth;
            let videoHeight = this.video.videoHeight;

            let width = this.canvas.width;
            let height = this.canvas.height;

            let context = this.canvas.getContext('2d');

            let startPosX = Math.floor((videoWidth - width) / 2);
            let startPosY = Math.floor((videoHeight - height) / 2);

            //绘制当前视频帧
            context.drawImage(this.video, startPosX, startPosY, width, height, 0, 0, width, height);

            let imageData = context.getImageData(0, 0, width, height);
            //得到灰度图矩阵
            let img_u8 = this.featTrainer.getGrayScaleMat(imageData);

            this.screen_features = this.featTrainer.describeFeatures(img_u8);
        }

        // 图像匹配，得出在当前帧模板图角点的位置
        _match() {
            let matches = this.featTrainer.matchPattern(this.screen_features.descriptors, this.pattern_features.descriptors)
            //根据匹配的特征点，找到当前帧与模板的转换矩阵
            let transform_result = this.featTrainer.findTransform(matches, this.screen_features.keyPoints, this.pattern_features.keyPoints);

            if (!matches || !transform_result) {
                return;
            }

            let num_matches = matches.length;
            let good_matches = transform_result.goodMatch;


            if (num_matches && good_matches > 8) {
                //得到模板图的四个点在当前帧中的坐标
                let hom3x3 = transform_result.transform;
                warp_perspective_zp(this.pattern_pos, this.frame_pos, hom3x3);
                let corners = [], pos;
                for (let i = 0; i < 4; i++) {
                    pos = this.frame_pos[i];
                    corners.push({x: pos[0], y: pos[1]});
                }
                this.corners = corners;
            } else {
                this.corners = null;
            }
        }

        // 图像识别
        recognize() {
            // console.log('start:' + (new Date()).getTime())
            this._describeFrame();
            this._match();
        }

    }

    class ImageController {
        constructor({renderer, scene, camera, model, modelState, video, patternSize, videoFrameCanvas, param}) {

            this.canvas = videoFrameCanvas;

            //three.js
            this.renderer = renderer;
            this.scene = scene;
            this.camera = camera;
            this.camera.matrixAutoUpdate = true;
            this.camera.fov = 40;
            this.camera.near = 1;
            this.camera.far = 1000;
            this.camera.position.set(0, 0, 10);
            this.camera.lookAt(this.scene.position);
            this.model = model;
            this.modelState = modelState;
            this.recognizer = null;
            this.posit = new POS.Posit(patternSize, defaultWidth);
            this.video = video;

            this.param = param;

            this.stopFrame = null;

            this.onFrame = this.onFrame.bind(this);
            this.update = this.update.bind(this);
            this.init();
        }

        // 初始化图像识别器
        init() {
            if (!this.param) {
                console.log('没有设置图像识别相关参数')
            }

            this.model.scale.set(0.1, 0.1, 0.1);

            if (this.param.method === 'server' && this.param.serverPath) {
                this.recognizer = new ServerRecognizer({
                    video: this.video,
                    canvas: this.canvas,
                    serverPath: this.param.serverPath,
                    requestMark: this.param.requestMark,
                    receiveMark: this.param.receiveMark,
                    protocol: this.param.protocol,
                    period: this.param.period || 50,
                });
                return;
            }

            // 如果没有传递参数，默认是前端识别，若是指定识别方式是前端，采用前端图像识别

            if (!this.param.patternImg) {
                console.log('采用前端识别必须指定目标图像id');
                return;
            }
            let patternImgId = this.param.patternImg;
            try {
                this.patternImg = document.getElementById(patternImgId);
            } catch (e) {
                console.log(e)
                return;
            }

            this.recognizer = new FrontRecognizer({
                video: this.video,
                canvas: this.canvas,
                patternImg: this.patternImg
            });

        }

        update() {
            if (this.recognizer) {
                this.recognizer.recognize();
                // 检查corners是否发生了变化，若是变化，则重新定位模型
                let curposition = this.recognizer.corners;
                if (curposition && !this.preposition) {
                    this.scene.add(this.model);
                }
                if (curposition && this.preposition !== curposition) {
                    this.locateModel(curposition);
                    this.preposition = curposition;
                }
            } else {
                console.log('未创建识别器')
            }
        }

        //定位模型
        locateModel(position) {
            if (!this.model) {
                return;
            }
            let markers = [{corners: position}];
            let corners, corner, pose, i;

            // let size = this.renderer.getSize();
            let size = this.canvas;

            if (markers.length > 0) {
                corners = markers[0].corners;
                for (i = 0; i < corners.length; ++i) {
                    corner = corners[i];

                    corner.x = corner.x - (size.width / 2);
                    corner.y = (size.height / 2) - corner.y;
                }

                //根据目标图像四个角点的位置计算出相机的当前姿态
                pose = this.posit.pose(corners);

                /*           let r = pose.bestRotation;
                           let t = pose.bestTranslation;
                           let r_m = new THREE.Matrix3();
                           r_m.set(
                               r[0][0], r[0][1], r[0][2],
                               r[1][0], r[1][1], r[1][2],
                               r[2][0], r[2][1], r[2][2]
                           );

                           let r_t = new THREE.Matrix3();
                           r_t.set(
                               1, 0, t[0],
                               0, 1, t[1],
                               0, 0, t[2],
                           );
                           console.log(r_m);

                           let m = new THREE.Matrix3();

                           m.multiply(r_m, r_t);
                           console.log(m);
           */
                // poseMatrix.multiplyMatrices(pose.bestRotation, pose.bestTranslation);
                //
                // this.updateModel2(this.modelScale, poseMatrix)

                //更新模型的姿态
                // updateObject(model, pose.bestRotation, pose.bestTranslation);
                // this.updateModel(this.modelScale, pose.bestRotation, pose.bestTranslation);
                this.updateModel(this.modelState.scale_size, pose.bestRotation, pose.bestTranslation);
            }
        }

        updateModel2(modelScale, poseMatrix) {
            this.model.scale.set(modelScale, modelScale, modelScale);
            this.model.setFromMatrix(poseMatrix);
        }

        updateModel(modelScale, rotation, translation) {
            this.model.scale.x = modelScale;
            this.model.scale.y = modelScale;
            this.model.scale.z = modelScale;

            if (rotation) {
                this.model.rotation.x = -Math.asin(-rotation[1][2]);
                this.model.rotation.y = -Math.atan2(rotation[0][2], rotation[2][2]);
                this.model.rotation.z = Math.atan2(rotation[1][0], rotation[1][1]);
            }
            // this.model.setFromRotationMatrix(rotat)

            this.model.rotateX(Math.PI / 2);

            if (translation) {
                this.model.position.x = translation[0];
                this.model.position.y = translation[1];
                this.model.position.z = -translation[2];
            }
        }

        onFrame() {
            this.stopFrame = requestAnimationFrame(this.onFrame);
            this.update();
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
        }
    }

    return ImageController;
});
