require.config({
    baseUrl: '/examples/ar_simple',
    paths: {
        io: 'libs/socket.io/socket.io',
        // OrbitControls: 'libs/OrbitControls',
        eventHandlerBase: 'utils/eventHandlerBase',
    },
    shim: {
        // OrbitControls: {exports: 'THREE.OrbitControls'}
    }
});

define(['io', /*'OrbitControls', */'eventHandlerBase'], function (io, /*OrbitControls,*/ EventHandlerBase) {
    class GPSController extends EventHandlerBase {
        constructor({renderer, scene, camera, model, modelSize, param}) {
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

            this.param = param;

            this.stopFrame = null;
            this.onFrame = this.onFrame.bind(this);
            this._init();
        }

        _init() {
            if (!this.param) return;
            this.update = this.param.update ? this.param.update.bind(this) : this.update;
            this.handleAddress = this.param.handleAddress ? this.param.handleAddress.bind(this) : this.handleAddress;
            // this.socket = io.connect(this.param.serverPath);
            this._addListeners();
            /*let baidyAPI = document.createElement('script');
            baidyAPI.type = 'text/javascript';
            baidyAPI.src = 'https://api.map.baidu.com/api?v=2.0&ak=8z63nTSBBiK7k0sVVZ77rHaaRgMszV2P';
            document.body.appendChild(baidyAPI);*/

            // this.serverPath = 'https://10.28.161.133:8081';

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
            this.addEventListener(GPSController.ADDRESS, function (event) {
                this.handleAddress(event.detail);
            }.bind(this));
        }

        // 处理获取的地点信息
        handleAddress(loc) {
            /*let _self = this;
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
            this.socket.emit('LOC_MESS', JSON.stringify(event.detail));*/
        }


        /* 数据更新 */
        update() {

        }


    }


    GPSController.ADDRESS = 'address';

    return GPSController;
});