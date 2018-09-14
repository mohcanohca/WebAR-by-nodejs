// MODIFY THIS TO THE APPROPRIATE URL IF IT IS NOT BEING RUN LOCALLY
// var socket = io.connect('https://172.22.118.38:3000');
// var socket = io.connect('https://10.208.25.199:8081');
var socket = io.connect('https://127.0.0.1:8081');

//获取用于绘制目标图像位置的canvas画布
var canvasFace = document.getElementById('canvas-face');
var ctx = canvasFace.getContext('2d');

socket.on('frame', handlePosition);

function handlePosition(data) {
    let canvasFace = document.getElementById('canvas-face');
    let ctx = canvasFace.getContext('2d');

    let rotation = null, transition = null;
    ctx.clearRect(0, 0, canvasFace.width, canvasFace.height);
    ctx.strokeStyle = "red";
    rotation = data.rotation;
    transition = data.transition;

    let points = data.position;
    if (!points) return;
    ctx.beginPath();
    for (let point of points) {
        let x = point.x;
        let y = point.y;
        // ctx.arc(x, y, 5, 0, Math.PI * 2, true); // 绘制
        ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.closePath();
}

function controlModule() {
    var container;
    
    var camera, scene, renderer;
    
    var cube, plane;
    
    var targetRotation = 0;
    
    var mouseX = 0;
    var mouseXOnMouseDown = 0;
    
    var windowHalfX = 640 / 2;
    var windowHalfY = 480 / 2;
    
    init();
    animate();
    
    function init() {
        
        container = document.createElement('div');
        document.body.appendChild(container);
        
        camera = new THREE.PerspectiveCamera(70, 640 / 480, 1, 1000);
        camera.position.y = 150;
        camera.position.z = 500;
        
        scene = new THREE.Scene();
        scene.background = 'transparent';
        
        
        // Cube
        
        var geometry = new THREE.BoxGeometry(200, 200, 200);
        
        for (var i = 0; i < geometry.faces.length; i += 2) {
            
            var hex = Math.random() * 0xffffff;
            geometry.faces[i].color.setHex(hex);
            geometry.faces[i + 1].color.setHex(hex);
            
        }
        
        var material = new THREE.MeshBasicMaterial({vertexColors: THREE.FaceColors, overdraw: 0.5});
        
        cube = new THREE.Mesh(geometry, material);
        cube.position.y = 150;
        scene.add(cube);
        
        // Plane
        
        var geometry = new THREE.PlaneBufferGeometry(200, 200);
        
        geometry.rotateX(-Math.PI / 2);
        
        var material = new THREE.MeshBasicMaterial({color: 0xe0e0e0, overdraw: 0.5});
        
        plane = new THREE.Mesh(geometry, material);
        scene.add(plane);
        
        renderer = new THREE.CanvasRenderer();
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(640, 480);
        container.appendChild(renderer.domElement);
        
        
        /*document.addEventListener( 'mousedown', onDocumentMouseDown, false );
        document.addEventListener( 'touchstart', onDocumentTouchStart, false );
        document.addEventListener( 'touchmove', onDocumentTouchMove, false );*/
        
        //
        
        window.addEventListener('resize', onWindowResize, false);
        
    }
    
    function onWindowResize() {
        
        windowHalfX = 640 / 2;
        windowHalfY = 480 / 2;
        
        camera.aspect = 640 / 480;
        camera.updateProjectionMatrix();
        
        renderer.setSize(640, 480);
        
    }
    
    //
    
    function animate() {
        
        requestAnimationFrame(animate);
        
        render();
        
    }
    
    function render() {
        
        if (rotation && transition) {
            /*cube.rotation.x = -Math.asin(-rotation[1][2]);
            cube.rotation.y = -Math.atan2(rotation[0][2], rotation[2][2]);
            cube.rotation.z = Math.atan2(rotation[1][0], rotation[1][1]);*/
            /*            cube.rotation.x=rotation.thetax;
                        cube.rotation.y=rotation.thetay;
                        cube.rotation.z=rotation.thetaz;
                        */
            
            console.log(transition)
            cube.position.x = (transition[0]) * 0.01;
            cube.position.y = (transition[1]) * 0.01;
            cube.position.z = (transition[2]) * 0.01;
        }
        
        
        // plane.rotation.y = cube.rotation.y += ( targetRotation - cube.rotation.y ) * 0.05;
        renderer.render(scene, camera);
        
    }
}




