require.config({
    baseUrl: '/examples/ar_simple',
    paths: {
        io: 'libs/socket.io/socket.io',
        orbitControl: 'libs/OrbitControls',
        eventHandlerBase: 'utils/eventHandlerBase',
    }
});
define(['io', 'orbitControl', 'eventHandlerBase'], function (io, OrbitControl, EventHandlerBase) {
    class GPSController extends EventHandlerBase {
        constructor({renderer, scene, camera, model, modelSize}) {
            super()
            //three.js
            this.renderer = renderer;
            this.scene = scene;
            // this.camera = new THREE.PerspectiveCamera(45,window.innerWidth / window.innerHeight,1,1000);
            //创建camera后再修改器焦距等参数是无法生效的
            this.camera = camera;
            // this.camera.matrixAutoUpdate = false;
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.lookAt(this.scene.position);

            this.model = model;
            this.modelSize = modelSize;

            this.stopFrame = null;
            this.onFrame = this.onFrame.bind(this);
            this.init();
        }

        init() {
            this._addListeners()
            /*let baidyAPI = document.createElement('script');
            baidyAPI.type = 'text/javascript';
            baidyAPI.src = 'https://api.map.baidu.com/api?v=2.0&ak=8z63nTSBBiK7k0sVVZ77rHaaRgMszV2P';
            document.body.appendChild(baidyAPI);*/

            this.serverPath = 'https://10.28.161.133:8081';
            this.socket = io.connect(this.serverPath)
            try {
                this._geoFindMe();
            } catch (e) {
                console.log('请求地理位置信息失败');
                return;
            }
        }

        onFrame() {
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            this.update();
            this.stopFrame = requestAnimationFrame(this.onFrame);
        }

        //获取地址
        _geoFindMe() {
            let _self = this;
            // 百度地图API功能
            //地图初始化
            let map = new BMap.Map("allmap");

            //GPS坐标转换成百度坐标
            let convertor = new BMap.Convertor();
            let pointArr = [];


            if (!navigator.geolocation) {
                console.log('Geolocation is not supported by your browser');
                return;
            }

            function success(position) {
                //GPS坐标
                var latitude = position.coords.latitude;
                var longitude = position.coords.longitude;

                var ggPoint = new BMap.Point(longitude, latitude);
                pointArr.push(ggPoint);

                convertor.translate(pointArr, 1, 5, function (data) {
                    //坐标转换完成后
                    if (data.status === 0) {
                        let point = data.points[0];
                        let gc = new BMap.Geocoder();

                        gc.getLocation(point, function (rs) {
                            var addressComponents = rs.addressComponents;
                            _self.dispatchEvent(new CustomEvent(GPSController.ADDRESS, {detail: addressComponents}));
                        });
                    }
                })
            }

            function error() {
                console.log("Unable to retrieve your location");
            }

            navigator.geolocation.getCurrentPosition(success, error);
        }

        _addListeners() {
            this.addEventListener(GPSController.ADDRESS, this.handleAddress.bind(this))
        }

        // 处理获取的地点信息
        handleAddress(event) {
            let _self = this;
            if (!this.socket) {
                //连接服务器端，传输数据
                this.socket = io.connect(this.serverPath);
            }
            //由于存在跨域问题，由server获取天气并返回
            this.socket.on('weather', function (data) {
                _self._showWeather(data.weather);
            });
            // debugger

            //使用websocket传输地理位置信息
            this.socket.emit('LOC_MESS', JSON.stringify(event.detail));
        }

        //根据天气情况，渲染不同的场景
        _showWeather(weather) {
            this.scene.add(this.model)
            let controller = new OrbitControl(this.camera, this.renderer.domElement);
        }

        /* 数据更新 */
        update() {
            // debugger
            let vertices = this.model.geometry.vertices;
            vertices.forEach(function (v) {

                v.y = v.y - (v.velocityY);
                v.x = v.x - (v.velocityX);

                if (v.y <= 0) v.y = 60;
                if (v.x <= -20 || v.x >= 20) v.velocityX = v.velocityX * -1;

            });

            /* 顶点变动之后需要更新，否则无法实现雨滴特效 */
            this.model.geometry.verticesNeedUpdate = true;
        }


    }


    GPSController.ADDRESS = 'address';
    GPSController.POSITION = 'position';

    return GPSController;
});