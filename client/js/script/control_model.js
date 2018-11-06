define('control_model', function () {
    let defaultThreeWidth = 640;
    let defaultThreeHeight = 480;

    //初始化three.js相关环境
    function initThree(width, height, container) {
        // 创建一个场景，它能放置所有元素，如网格对象、摄像机、灯光等
        let scene = new THREE.Scene();
        scene.background = 'transparent';

        // 创建一个摄像机
        //arg1：摄像机能看到的视野，推荐默认值为50
        //arg2：渲染结果的横向尺寸和纵向尺寸的比值
        //arg3：从距离摄像机多近的距离开始渲染，推荐默认值0.1
        //arg4：摄像机从它所处的位置开始能看到多远。若过小，那么场景中的远处不会被渲染，推荐默认值1000

        width = width || defaultThreeWidth;
        height = height || defaultThreeHeight;
        let camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

        // 初始化摄像机插件（用于拖拽旋转摄像机，产生交互效果）
        let orbitControls = new THREE.OrbitControls(camera);

        // 设置摄像机位置，并将其朝向场景中心
        camera.position.x = 0
        camera.position.y = 0
        camera.position.z = 200
        camera.lookAt(scene.position);
        scene.add(camera);

        // 添加环境光，用于提亮场景
        let ambientLight = new THREE.AmbientLight(0x0c0c0c);
        scene.add(ambientLight);

        // 添加聚光灯
        let spotLight = new THREE.SpotLight(0xffffff);
        spotLight.position.set(-40, 60, -10);

        scene.add(spotLight);

        // 创建一个渲染器，并设置其清除颜色和大小
        // var renderer = new THREE.WebGLRenderer({alpha: true});
        var renderer = new THREE.CanvasRenderer({alpha: true});
        // renderer.setClearColor(0xffffff, 1.0);
        renderer.setSize(width, height);

        // 将渲染器的输出（canvas）插入到特定 DOM 元素下
        if (container) {
            container.appendChild(renderer.domElement);
        } else {
            //若没有提供three.js的输出容器，创建一个容器
            let body = document.body;
            container = document.createElement('div');
            container.style.width = width + 'px';
            container.style.height = height + 'px';
            container.style.position = 'absolute';
            container.style.top = '0px';
            container.style.left = '0px';
            container.style.zIndex = 999;
            body.appendChild(container);
            container.appendChild(renderer.domElement);
        }
        render();

        function render() {
            // render using requestAnimationFrame
            renderer.render(scene, camera);
            requestAnimationFrame(render);
        }

        let originModel;

        return function (center, model) {
            if (originModel) scene.remove(originModel);

            if (!model) {
                // 创建一个立方体
                let cubeGeometry = new THREE.BoxGeometry(40, 40, 40);
                let cubeMaterial = new THREE.MeshLambertMaterial({color: 0xff0000});
                originModel = new THREE.Mesh(cubeGeometry, cubeMaterial);
            } else {
                originModel = model;
            }
            // model = model;
            // 设置立方体的位置
            originModel.position.x = (center.x - width / 2) / 2;
            originModel.position.y = (center.y - height / 2) / 2;
            // cube.position.x = 20;
            // cube.position.y = 10;
            originModel.position.z = 0;
            console.log(originModel.position.x, originModel.position.y, originModel.position.z)

            // 添加虚拟物体至场景
            scene.add(originModel);
        };
    }

    function updateModel() {

    }

    return {
        init: initThree,
        update: updateModel,
    }
});