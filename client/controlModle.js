
function controlModule(path,eventStyle) {
    var container, stats;
    var camera, scene, projector, renderer;
    var mesh, mixer;
    var theta = 0;
    init();
    animate();

    function init() {

        container = document.createElement( 'div' );
        document.body.getElementsByClassName('container')[0].appendChild( container );
        container.style.zIndex="1000";

        //

        camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 10000 );
        camera.position.y = 300;
        camera.target = new THREE.Vector3( 0, 150, 0 );

        scene = new THREE.Scene();
        scene.background = 'transparent';

        //

        var light = new THREE.DirectionalLight( 0xefefff, 1.5 );
        light.position.set( 1, 1, 1 ).normalize();
        scene.add( light );

        var light = new THREE.DirectionalLight( 0xffefef, 1.5 );
        light.position.set( -1, -1, -1 ).normalize();
        scene.add( light );

        var loader = new THREE.JSONLoader();
        loader.load( path, function ( geometry ) {

            var material = new THREE.MeshLambertMaterial( {
                vertexColors: THREE.FaceColors,
                morphTargets: true,
                overdraw: 0.5
            } );

            mesh = new THREE.Mesh( geometry, material );
            mesh.scale.set( 1.5, 1.5, 1.5 );
            scene.add( mesh );

            mixer = new THREE.AnimationMixer( mesh );

            var clip = THREE.AnimationClip.CreateFromMorphTargetSequence( 'gallop', geometry.morphTargets, 30 );
            mixer.clipAction( clip ).setDuration( 1 ).play();

        } );

        renderer = new THREE.CanvasRenderer({ alpha: true });
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( 340, 278);
//        renderer.setClearColor(0x4584b4,0);
        container.appendChild(renderer.domElement);

        window.addEventListener( 'resize', onWindowResize, false );

    }

    function onWindowResize() {

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize( 340, 278 );
    }

    function animate() {

        requestAnimationFrame( animate );

/*        EventManager.listen(eventStyle,function (orientationInfo) {
            theta+=orientationInfo.z/360;
        });*/
        render();

    }

    var radius = 600;
    var prevTime = Date.now();

    function render() {

//        theta += 0.1;

        camera.position.x = radius * Math.sin( THREE.Math.degToRad( theta ) );
        camera.position.z = radius * Math.cos( THREE.Math.degToRad( theta ) );

        camera.lookAt( camera.target );

        if ( mixer ) {

            var time = Date.now();

            mixer.update( ( time - prevTime ) * 0.001 );

            prevTime = time;

        }

        renderer.render( scene, camera );

    }
}
controlModule('./models/horse.js');