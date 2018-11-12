define(['./OrbitControls'], function (OrbitControls) {

    let defaultThreeWidth = 640;
    let defaultThreeHeight = 480;
    let preposition, curposition;
    // let controller = PosController;//控制器

    let eventManager;

    /*    //初始化three.js相关环境
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
            // let orbitControls = new THREE.OrbitControls(camera);

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
        }*/


    var canvas, context, posit;
    var modelSize = 35.0; //millimeters毫米
    var video;


    var renderer;
    var scene2, scene_bg, scene_model;
    var camera2, camera_bg, camera_model;
    var model, texture;
    var step = 0.0;


    function handlePan() {
        console.log('handlePan')
    }


    //绘制marker的轮廓和marker的左上角
    function drawCorners(markers) {
        var corners, corner, i, j;

        context.lineWidth = 3;

        for (i = 0; i < markers.length; ++i) {
            corners = markers[i].corners;

            context.strokeStyle = "red";
            context.beginPath();

            for (j = 0; j < corners.length; ++j) {
                corner = corners[j];
                context.moveTo(corner.x, corner.y);
                corner = corners[(j + 1) % corners.length];
                context.lineTo(corner.x, corner.y);
            }

            context.stroke();
            context.closePath();

            context.strokeStyle = "green";
            context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
        }
    };

    //创建渲染器和场景
    function createRenderers() {
        //渲染器
        renderer = new THREE.WebGLRenderer();
        renderer.setClearColor(0xffffff, 1);
        renderer.setSize(canvas.width, canvas.height);
        document.getElementById("three-container").appendChild(renderer.domElement);

        /*        scene2 = new THREE.Scene();//用于添加几何体
                camera2 = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 1, 1000);
                camera2.position.x = 0
                camera2.position.y = 0
                camera2.position.z = 200
                camera2.lookAt(scene2.position);
                scene2.add(camera2);
                handControl(camera2);*/


        //使用正交投影相机
        scene_bg = new THREE.Scene();
        camera_bg = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5);
        scene_bg.add(camera_bg);

        //使用透视投影相机
        scene_model = new THREE.Scene();
        camera_model = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 1, 1000);
        //若要通过相机控制模型，需要设置相机的position
        camera_model.position.x = 0;
        camera_model.position.y = 0;
        camera_model.position.z = 10;
        camera_model.lookAt(scene_model.position);
        scene_model.add(camera_model);
    };

    function render() {

        //放置两个场景
        renderer.autoClear = false;
        renderer.clear();
        // addGeo(scene2);//在scene2中添加几何体

        renderer.render(scene_bg, camera_bg);
        renderer.render(scene_model, camera_model);
        // renderer.render(scene2, camera2);
    };

    let originModel;

    function addGeo(scene) {
        if (originModel) scene.remove(originModel);

        // 创建一个立方体
        let cubeGeometry = new THREE.BoxGeometry(100, 100, 100);
        let cubeMaterial = new THREE.MeshLambertMaterial({color: 0xff0000});
        originModel = new THREE.Mesh(cubeGeometry, cubeMaterial);

        // model = model;
        // 设置立方体的位置
        originModel.position.x = 20;
        originModel.position.y = 10;
        // cube.position.x = 20;
        // cube.position.y = 10;
        originModel.position.z = 0;
        // console.log(originModel.position.x, originModel.position.y, originModel.position.z)

        // 添加虚拟物体至场景
        scene.add(originModel);
    };

    //向场景中添加内容
    function createScenes() {

        //场景添加纹理，实际添加的是以当前视频流为纹理的对象
        texture = createTexture();
        scene_bg.add(texture);

        //场景添加模型，实际添加以地图图像为贴图的球体
        model = createModel();
        // scene_model.add(model);
    };

    //创建纹理，以视频流为颜色映射对象
    function createTexture() {
        //THREE.Texture():创建一个纹理应用到一个表面或作为反射或折射贴图
        var texture = new THREE.Texture(video),
            object = new THREE.Object3D(),
            geometry = new THREE.PlaneGeometry(1.0, 1.0, 0.0),
            //map:颜色映射，默认为空
            material = new THREE.MeshBasicMaterial({map: texture, depthTest: false, depthWrite: false}),
            mesh = new THREE.Mesh(geometry, material);
        texture.minFilter = THREE.LinearFilter;
        object.position.z = -1;

        object.add(mesh);

        return object;
    };

    //创建模型
    function createModel() {
        let object = new THREE.Object3D(),
            geometry = new THREE.SphereGeometry(0.5, 15, 15, Math.PI),
            loader = new THREE.TextureLoader();
        loader.load("./js/textures/earth.jpg", function (texture) {
            let material = new THREE.MeshBasicMaterial({map: texture});
            let mesh = new THREE.Mesh(geometry, material);
            object.add(mesh);
        });


        return object;
    };

    //更新场景，根据marker的四个角点的位置放置虚拟物体
    function updateScenes(/*markers*/) {
        texture.children[0].material.map.needsUpdate = true;
    };

    function updateModel(markers) {
        var corners, corner, pose, i;

        if (/*controller.current === 'position' && */markers.length > 0) {
            corners = markers[0].corners;

            for (i = 0; i < corners.length; ++i) {
                corner = corners[i];

                corner.x = corner.x - (canvas.width / 2);
                corner.y = (canvas.height / 2) - corner.y;
            }

            // console.log(corners);//Array4 [{x:-1,y:2},{x:-1,y:2},{x:-1,y:2},{x:-1,y:2}]
            pose = posit.pose(corners);


            updateObject(model, pose.bestRotation, pose.bestTranslation);

            step += 0.025;

            model.rotation.z -= step;
        }
    }

    function updateObject(object, rotation, translation) {
        object.scale.x = modelSize;
        object.scale.y = modelSize;
        object.scale.z = modelSize;

        object.rotation.x = -Math.asin(-rotation[1][2]);
        object.rotation.y = -Math.atan2(rotation[0][2], rotation[2][2]);
        object.rotation.z = Math.atan2(rotation[1][0], rotation[1][1]);

        object.position.x = translation[0];
        object.position.y = translation[1];
        object.position.z = -translation[2];
    };

    function onload(srcvideo, manager) {
        eventManager = manager;
        canvas = document.getElementById("canvas");
        context = canvas.getContext("2d");
        canvas.width = defaultThreeWidth;
        canvas.height = defaultThreeHeight;
        //初始化定位方法，参数：模型大小，焦距
        posit = new POS.Posit(modelSize, canvas.width);
        video = srcvideo;

        //添加事件
        // eventManager.listen('pan', handlePan);

        createRenderers();
        createScenes();

        tick();
    }

    function updatePosition(position) {
        curposition = position;
    }

    //重置相机的位置
    function resetCameraModel() {
        camera_model.position.x = 0
        camera_model.position.y = 0
        camera_model.position.z = 10
        camera_model.lookAt(scene_model.position);
    }


    function tick() {
        //告诉浏览器您希望执行动画并请求浏览器在下一次重绘之前调用指定的函数来更新动画
        requestAnimationFrame(tick);

        // console.log("当前controller是PosController？" + controller === PosController);

        updateScenes();


        if (curposition && preposition !== curposition) {
            if (!preposition) {
                scene_model.add(model);
            }

            let markers = [{corners: curposition}];
            // drawCorners(markers);
            // updateScenes(markers);
            updateModel(markers);
            // render();
            preposition = curposition;
        }

        render();
    };

    //用于屏幕触摸，键盘、鼠标控制
    function handControl() {
        // addGeo(scene2);
        let orbitController = new OrbitControls(camera_model);
    }

    return {
        onload: onload,
        locateModel: updatePosition,
        handControl: handControl,
        reset: resetCameraModel,
    }
});