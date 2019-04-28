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

    // 创建一个包含光源的场景
    function createLitScene() {
        const scene = new THREE.Scene();

        // The materials will render as a black mesh
        // without lights in our scenes. Let's add an ambient light
        // so our material can be visible, as well as a directional light
        // for the shadow.
        const light = new THREE.AmbientLight(0xffffff, 1);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
        directionalLight.position.set(10, 15, 10);

        // We want this light to cast shadow.
        directionalLight.castShadow = true;

        // Make a large plane to receive our shadows
        const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
        // Rotate our plane to be parallel to the floor
        planeGeometry.rotateX(-Math.PI / 2);

        // Create a mesh with a shadow material, resulting in a mesh
        // that only renders shadows once we flip the `receiveShadow` property.
        const shadowMesh = new THREE.Mesh(planeGeometry, new THREE.ShadowMaterial({
            color: 0x111111,
            opacity: 0.2,
        }));

        // Give it a name so we can reference it later, and set `receiveShadow`
        // to true so that it can render our model's shadow.
        shadowMesh.name = 'shadowMesh';
        shadowMesh.receiveShadow = true;
        shadowMesh.position.y = 10000;

        // Add lights and shadow material to scene.
        scene.add(shadowMesh);
        scene.add(light);
        scene.add(directionalLight);

        return scene;
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
                        socket.on('connect', function () {
                            //使用websocket传输地理位置信息
                            socket.emit('LOC_MESS', loc);
                        });

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
                            let content = document.getElementById('weather');

                            //根据天气情况，渲染不同的场景
                            let weather = data.weather;
                            let cur = weather.now.code;//天气代码
                            content.innerText = weather.location.name + '\n' + weather.now.temperature + '°C\n' + weather.now.text;

                            let MODEL_OBJ_URL = './assets/sun/model.obj';
                            let MODEL_MTL_URL = './assets/sun/materials.mtl';
                            let MODEL_SCALE = 1;
                            let MODEL_POS = null;
                            if (cur >= 0 && cur < 4) {
                                /* curImg = imgs['sun'];
                                 let texture = new THREE.TextureLoader().load(curImg);
                                 this.weatherContent = initWeatherContent(texture);
 */
                                MODEL_OBJ_URL = './assets/archive/Sun_483.obj';
                                MODEL_MTL_URL = './assets/archive/Sun_483.mtl';
                                MODEL_SCALE = 0.2;
                                MODEL_POS = {position: {x: 0, y: 10, z: -100}, rotation: {x: 0, y: 0, z: 0}};
                                //晴天
                                console.log(weather);
                            } else if (cur >= 4 && cur < 9) {
                                /*curImg = imgs['cloud'];
                                let texture = new THREE.TextureLoader().load(curImg);
                                this.weatherContent = initWeatherContent(texture);*/
                                MODEL_OBJ_URL = './assets/cloudy/model.obj';
                                MODEL_MTL_URL = './assets/cloudy/materials.mtl';
                                MODEL_SCALE = 10;
                                MODEL_POS = {
                                    position: {x: 8, y: 18, z: -80},
                                    rotation: {x: 1.25 * Math.PI, y: 0.25 * Math.PI, z: 0}
                                };

                                //多云
                                console.log(weather);

                            } else if (cur === 9) {
                                /* curImg = imgs['overcast'];
                                 let texture = new THREE.TextureLoader().load(curImg);
                                 this.weatherContent = initWeatherContent(texture);*/
                                MODEL_OBJ_URL = './assets/cloudy/model.obj';
                                MODEL_MTL_URL = './assets/cloudy/materials.mtl';
                                MODEL_SCALE = 1;

                                //阴天
                                console.log(weather.now.text);

                            } else if (cur > 9 && cur < 20) {
                                /*curImg = imgs['rain'];
                                let texture = new THREE.TextureLoader().load(curImg);
                                this.weatherContent = initWeatherContent(texture);*/
                                MODEL_OBJ_URL = './assets/rain_lightning_storm/model.obj';
                                MODEL_MTL_URL = './assets/rain_lightning_storm/materials.mtl';
                                MODEL_SCALE = 1;

                                //雨天
                                console.log(weather.now.text);
                            } else if (cur >= 20 && cur <= 25) {

                                MODEL_OBJ_URL = './assets/snowman/model.obj';
                                MODEL_MTL_URL = './assets/snowman/materials.mtl';
                                MODEL_SCALE = 1;

                                //雪天
                                console.log(weather.now.text);

                            } else {
                                MODEL_OBJ_URL = './assets/sun/model.obj';
                                MODEL_MTL_URL = './assets/sun/materials.mtl';
                                MODEL_SCALE = 1;

                                //其他天气
                                console.log(weather.now.text);
                            }
                            loadModel(MODEL_OBJ_URL, MODEL_MTL_URL).then(model => {
                                this.model = model;
                                if (MODEL_POS) {
                                    let position = MODEL_POS.position || {x: 0, y: 0, z: 0};
                                    let rotation = MODEL_POS.rotation || {x: 0, y: 0, z: 0};

                                    this.model.rotation.set(rotation.x, rotation.y, rotation.z);
                                    this.model.position.set(position.x, position.y, position.z);
                                }

                                this.model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
                                this.scene.add(this.model);
                            });
                        }.bind(this));


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
            this.scene = createLitScene();
        }

        initModel() {
            let MODEL_OBJ_URL = './assets/sun/model.obj';
            let MODEL_MTL_URL = './assets/sun/materials.mtl';
            let MODEL_SCALE = 1;
            loadModel(MODEL_OBJ_URL, MODEL_MTL_URL).then(model => {
                this.model = model;
                this.model.position.set(0, 0, -100);
                this.model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
                // this.scene.add(this.model);
            });
        }
    }


    window.app = new WeatherAPP();

})


