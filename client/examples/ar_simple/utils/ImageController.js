require.config({
    baseUrl: '/examples/ar_simple',
    paths: {
        io: 'libs/socket.io/socket.io',
        CV: 'libs/cv',
        jsfeat: 'libs/jsfeat',
        FeatTrainer: 'utils/FeatTrainer',
        svd: 'libs/svd',
        POS: 'libs/posit'
    },
    shim: {
        jsfeat: {exports: 'jsfeat'},
        FeatTrainer: {exports: 'FeatTrainer'},
        CV: {exports: 'CV'},
        svd: {exports: 'svd'},
        POS: {exports: 'POS'},
        jquery: {exports: '$'}

    }
});

define(['io', 'CV', 'jsfeat', 'FeatTrainer', 'svd', 'POS', '$'], function (io, CV, jsfeat, featTrainer, svd, POS, $) {
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
    class ServerRecognizer {
        constructor(video, canvas, serverPath, protocol) {
            this.socket = null;
            this.serverPath = serverPath;
            this.protocol = protocol;
            // this.serverPath = 'https://10.208.25.196:8081';
            // this.serverPath = 'https://10.28.201.198:8081';
            this.timer = null;
            this.canvas = canvas;
            this.corners = null;
            this.video = video;
            this.ableSend = false;
            this.start()
            this.stop = this.stop.bind(this)

        }

        handleFrameCorners(data) {
            console.log('receive:' + (new Date()).getTime())
            let corners = data.corners;
            if (!corners) return;
            this.corners = corners;
        }

        // 开始图像识别
        start() {
            let default_video_period = 100;
            let video_period = 100;
            let _self = this;
            if (this.protocol === 'ws') {
                //若是采用websoc通信协议
                if (!this.socket) {
                    //连接服务器端，传输数据
                    this.socket = io.connect(this.serverPath);
                    this.socket.on('connect', function () {
                        _self.ableSend = true;
                    });
                    this.socket.on('frame', this.handleFrameCorners.bind(this));
                }
            }

            //定时向后端传输图像数据
            this.timer = setInterval(function () {
                //发送视频帧
                if (_self.protocol === 'ws' && _self.ableSend) {
                    let imgData = drawImage(_self.video);

                    let data = {
                        imgData: imgData,
                    };
                    console.log('emit VIDEO_MESS:' + (new Date()).getTime())
                    //使用websocket进行图像传输
                    _self.socket.emit('VIDEO_MESS', JSON.stringify(data));
                } else {
                    //通过ajax发送数据
                    //在收到响应后调用this.handleFrameCorners
                    $.ajax({
                        url: _self.serverPath,
                        dataType: 'jsonp',
                        success: function (data) {
                            _self.handleFrameCorners(data.data);
                        }
                    });
                }

            }, video_period || default_video_period);


            //绘制图像
            function drawImage(video) {
                let videoWidth = video.videoWidth;
                let videoHeight = video.videoHeight;

                let width = _self.canvas.width;
                let height = _self.canvas.height;
                /*let windowWidth = window.innerWidth;
                let windowHeight = window.innerHeight;*/

                /*_self.canvas.width = windowWidth;
                _self.canvas.height = windowHeight;*/

                let context = _self.canvas.getContext('2d');

                let startPosX = Math.floor((videoWidth - width) / 2);
                let startPosY = Math.floor((videoHeight - height) / 2);

                //绘制当前视频帧
                context.drawImage(video, startPosX, startPosY, width, height, 0, 0, width, height);

                let jpgQuality = 0.6;
                let imageDataURL = _self.canvas.toDataURL('image/jpeg', jpgQuality);//转换成base64编码
                return imageDataURL;
            }
        }

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
        constructor(video, canvas, patternImg) {
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
            console.log('get corners:' + (new Date()).getTime())
        }

        // 图像识别
        recognize() {
            console.log('start:' + (new Date()).getTime())
            this._describeFrame();
            this._match();
        }

    }

    class ImageController {
        constructor({sessionEls, renderer, scene, camera, model, video, modelSize, videoFrameCanvas, param}) {
            // 绘制视频帧
            this.sessionEls = sessionEls;
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
            this.modelSize = modelSize;

            this.recognizer = null;
            this.posit = new POS.Posit(modelSize || 35, Math.max(defaultWidth, defaultHeight));
            this.video = video;

            this.param = param;

            this.stopFrame = null;

            // this.patternImg = param.patternImg;

            this.onFrame = this.onFrame.bind(this);
            this.update = this.update.bind(this);
            this.init();
        }

        // 初始化图像识别器
        init() {
            let _self = this;
            if (!this.param) {
                console.log('没有设置图像识别相关参数')
            }

            if (this.param.method === 'server' && this.param.serverPath) {
                this.recognizer = new ServerRecognizer(this.video, this.canvas, this.param.serverPath, this.param.protocol);
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

            this.recognizer = new FrontRecognizer(this.video, this.canvas, this.patternImg);
            /*let patternImg = new Image();
            patternImg.src = './assets/pattern.jpg';

            patternImg.onload = function () {
                _self.patternImg = patternImg;
                _self.recognizer = new FrontRecognizer(_self.video, _self.canvas, _self.patternImg);
            }*/


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
            this.stopFrame = requestAnimationFrame(this.onFrame);
            this.update();
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
        }
    }

    return ImageController;
});
