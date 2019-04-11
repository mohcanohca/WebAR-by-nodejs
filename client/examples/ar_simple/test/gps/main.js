require.config({
    paths: {
        ARController: '../../utils/ARController'
    }
});

define(['ARController'], function (ARControllerBase) {
    const opacityRemap = mat => {
        if (mat.opacity === 0) {
            mat.opacity = 1;
        }
    };

    // 加载模型
    function loadModel(objURL, mtlURL) {
        // OBJLoader and MTLLoader are not a part of three.js core, and
        // must be included as separate scripts.
        const objLoader = new THREE.OBJLoader();
        const mtlLoader = new THREE.MTLLoader();

        // Set texture path so that the loader knows where to find
        // linked resources
        mtlLoader.setTexturePath(mtlURL.substr(0, mtlURL.lastIndexOf('/') + 1));

        // remaps ka, kd, & ks values of 0,0,0 -> 1,1,1, models from
        // Poly benefit due to how they were encoded.
        mtlLoader.setMaterialOptions({ignoreZeroRGBs: true});

        // OBJLoader and MTLLoader provide callback interfaces; let's
        // return a Promise and resolve or reject based off of the asset
        // downloading.
        return new Promise((resolve, reject) => {
            mtlLoader.load(mtlURL, materialCreator => {
                // We have our material package parsed from the .mtl file.
                // Be sure to preload it.
                materialCreator.preload();

                // Remap opacity values in the material to 1 if they're set as
                // 0; this is another peculiarity of Poly models and some
                // MTL materials.
                for (let material of Object.values(materialCreator.materials)) {
                    opacityRemap(material);
                }

                // Give our OBJ loader our materials to apply it properly to the model
                objLoader.setMaterials(materialCreator);

                // Finally load our OBJ, and resolve the promise once found.
                objLoader.load(objURL, resolve, function () {
                }, reject);
            }, function () {
            }, reject);
        });
    }

    class WeatherAPP extends ARControllerBase {
        constructor() {
            super({
                useReticle: false,
                useSelect: false,
                baseControlType: ARControllerBase.GPSCONTROLLER,
                baseControlParam: {
                    update: function () {
                        if (!this.weatherContent) return;
                        let vertices = this.weatherContent.geometry.vertices;
                        vertices.forEach(function (v) {

                            v.y = v.y - (v.velocityY);
                            v.x = v.x - (v.velocityX);

                            if (v.y <= 0) v.y = 60;
                            if (v.x <= -20 || v.x >= 20) v.velocityX = v.velocityX * -1;

                        });

                        /* 顶点变动之后需要更新，否则无法实现雨滴特效 */
                        this.weatherContent.geometry.verticesNeedUpdate = true;
                    },
                    handleAddress: function (loc) {
                        let socket = io.connect('https://10.28.254.113:8081');

                        //创建天气场景
                        function initWeatherContent(texture) {
                            let geometry = new THREE.Geometry();
                            let pointsMaterial = new THREE.PointsMaterial({
                                size: 2,
                                transparent: true,
                                opacity: 0.8,
                                map: texture,
                                blending: THREE.AdditiveBlending,
                                sizeAttenuation: true,
                                depthTest: false
                            });

                            let range = 100;
                            for (let i = 0; i < 1500; i++) {

                                let vertice = new THREE.Vector3(
                                    Math.random() * range - range / 2,
                                    Math.random() * range * 1.5,
                                    Math.random() * range - range / 2);
                                /* 纵向移动速度 */
                                vertice.velocityY = 0.1 + Math.random() / 3;
                                /* 横向移动速度 */
                                vertice.velocityX = (Math.random() - 0.5) / 3;

                                /* 将顶点加入几何 */
                                geometry.vertices.push(vertice);
                            }

                            geometry.center();

                            let points = new THREE.Points(geometry, pointsMaterial);
                            points.position.y = -30;

                            return points;
                        }

                        //由于存在跨域问题，由server获取天气并返回
                        socket.on('weather', function (data) {

                            //根据天气情况，渲染不同的场景
                            let weather = data.weather;
                            let cur = weather.now.code;
                            // let imgs = this.param.imgs;
                            let imgs = {
                                'sun': './assets/snow-32.png',
                                'cloud': './assets/snow-32.png',
                                'overcast': './assets/snow-32.png',
                                'rain': './assets/snow-32.png',
                                'snow': './assets/snow-32.png',
                                'wind': './assets/snow-32.png',
                            };
                            let curImg = null;
                            cur = 22;
                            if (cur >= 0 && cur <= 4) {
                                curImg = imgs['sun'];
                                let texture = new THREE.TextureLoader().load(curImg);
                                this.weatherContent = initWeatherContent(texture);

                                //晴天
                                console.log(weather.now.text);
                            } else if (cur > 4 && cur < 9) {
                                curImg = imgs['cloud'];
                                let texture = new THREE.TextureLoader().load(curImg);
                                this.weatherContent = initWeatherContent(texture);
                                //多云
                                console.log(weather.now.text);

                            } else if (cur === 9) {
                                curImg = imgs['overcast'];
                                let texture = new THREE.TextureLoader().load(curImg);
                                this.weatherContent = initWeatherContent(texture);
                                //阴天
                                console.log(weather.now.text);

                            } else if (cur > 9 && cur < 20) {
                                curImg = imgs['rain'];
                                let texture = new THREE.TextureLoader().load(curImg);
                                this.weatherContent = initWeatherContent(texture);
                                //雨天
                                console.log(weather.now.text);
                            } else if (cur >= 20 && cur <= 25) {
                                curImg = imgs['snow'];
                                let texture = new THREE.TextureLoader().load(curImg);
                                this.weatherContent = initWeatherContent(texture);
                                //雪天
                                console.log(weather.now.text);

                            } else {
                                curImg = imgs['wind'];
                                let texture = new THREE.TextureLoader().load(curImg);
                                this.weatherContent = initWeatherContent(texture);
                                //其他天气
                                console.log(weather.now.text);
                            }
                            this.scene.add(this.weatherContent);
                        }.bind(this));

                        //使用websocket传输地理位置信息
                        socket.emit('LOC_MESS', JSON.stringify(loc));
                    }
                }
            })
        }

        setAREntrance(callback) {
            document.querySelector('#enter-ar').addEventListener('click', callback, false);
        }

        addListeners() {
            this.addEventListener(ARControllerBase.SESSIONSTART, function () {
                // 将页面样式切换至ar会话状态
                document.body.classList.add('ar');
            });
        }

        initScene() {
            this.scene = new THREE.Scene();
        }

        initModel() {
            const MODEL_OBJ_URL = './assets/ArcticFox_Posed.obj';
            const MODEL_MTL_URL = './assets/ArcticFox_Posed.mtl';
            const MODEL_SCALE = 1;
            loadModel(MODEL_OBJ_URL, MODEL_MTL_URL).then(model => {
                this.model = model;
                // this.modelSize = MODEL_SCALE;
                this.modelState = {scale_size: MODEL_SCALE};
                // Every model is different -- you may have to adjust the scale
                // of a model depending on the use.
                this.model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
            });

            // this.model = initWeatherContent(texture);
        }
    }


    // window.app = new ARSea();
    // window.app = new ModelExample();
    // window.app = new EarthExample();//图像识别控制
    // window.app = new OrientationExample();//orientation控制模型
    // window.app = new OrientationCubeSea();//orientation控制相机
    // window.app = new OrbitExample();
    window.app = new WeatherAPP();

})


