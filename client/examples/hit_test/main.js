const Controllers = require('../../js/utils/controllers')
const XRDetect = Controllers.XRDetect;
const XRControllerBase = Controllers.XRControllerBase;

class HitTestExample extends XRControllerBase {
    constructor(domElement) {
        super(domElement, false)
        // A message at the bottom of the screen that shows whether a surface has been found
        this._messageEl = document.createElement('div')
        this.el.appendChild(this._messageEl)
        this._messageEl.style.position = 'absolute'
        this._messageEl.style.bottom = '10px'
        this._messageEl.style.left = '10px'
        this._messageEl.style.color = 'white'
        this._messageEl.style['font-size'] = '16px'

        this.el.addEventListener('touchstart', this._onTouchStart.bind(this), false)
    }

    // Called during construction to allow the app to populate this.scene
    initializeScene() {
        // Add a box at the scene origin
        let box = new THREE.Mesh(
            new THREE.BoxBufferGeometry(0.1, 0.1, 0.1),
            new THREE.MeshPhongMaterial({color: '#DDFFDD'})
        )
        box.position.set(0, 0.05, 0)
        var axesHelper = AxesHelper(0.2);
        this.floorGroup.add(axesHelper);
        this.floorGroup.add(box)

        // Add a few lights
        this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
        let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
        directionalLight.position.set(0, 10, 0)
        this.scene.add(directionalLight)
    }

    // Called once per frame, before render, to give the app a chance to update this.scene
    updateScene(frame) {
    }

    // Save screen taps as normalized coordinates for use in this.updateScene
    _onTouchStart(ev) {
        if (!ev.touches || ev.touches.length === 0) {
            console.error('No touches on touch event', ev)
            return
        }

        const x = ev.touches[0].clientX / window.innerWidth
        const y = ev.touches[0].clientY / window.innerHeight

        // Attempt a hit test using the normalized screen coordinates
        this.session.hitTest(x, y).then(anchorOffset => {
            if (anchorOffset === null) {
                this._messageEl.innerHTML = 'miss'
            } else {
                this._messageEl.innerHTML = 'hit'
                this.addAnchoredNode(anchorOffset, this._createSceneGraphNode())
            }
        }).catch(err => {
            console.error('Error in hit test', err)
        })
    }

    // Creates a box used to indicate the location of an anchor offset
    _createSceneGraphNode() {
        let group = new THREE.Group()
        let geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1)
        let material = new THREE.MeshPhongMaterial({color: '#99FF99'})
        let mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, 0.05, 0)
        group.add(mesh)
        return group
    }
}

function AxesHelper(size) {
    size = size || 1;

    var vertices = [
        0, 0, 0, size, 0, 0,
        0, 0, 0, 0, size, 0,
        0, 0, 0, 0, 0, size
    ];

    var colors = [
        1, 0, 0, 1, 0.6, 0,
        0, 1, 0, 0.6, 1, 0,
        0, 0, 1, 0, 0.6, 1
    ];

    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    var material = new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors});

    return new THREE.LineSegments(geometry, material);
}

window.eventManager.listen('supported', handleXRSupported)

Controllers.XRDetect();

async function handleXRSupported(supported) {
    if (supported) {
        let xrHitController = new Controllers.XRHitController();

        await xrHitController.getDevice();
        await xrHitController.getSession();
        document.body.appendChild(xrHitController.outputCanvas);
        await xrHitController.onSessionStarted();
    } else {
        try {
            window.pageApp = new HitTestExample(document.getElementById('target'))
        } catch (e) {
            console.error('page error', e)
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        try {
            window.pageApp = new HitTestExample(document.getElementById('target'))
        } catch (e) {
            console.error('page error', e)
        }
    }, 1000)
});