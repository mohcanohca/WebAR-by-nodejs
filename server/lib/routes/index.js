// Load the page
// NB: This needs to be the last route added
exports.serveIndex = function (app, staticFolder) {
    app.get('/', function (req, res) {
        res.sendFile('index.html', {root: staticFolder});
    });

    app.get('/examples/ar_simple', function (req, res) {
        res.sendFile('/examples/ar_simple/index.html', {root: staticFolder});
    });

    app.get('/examples/ar_simple/orientation', function (req, res) {
        res.sendFile('/examples/ar_simple/test/orientation/index.html', {root: staticFolder});
    });

    app.get('/examples/ar_simple/orbit', function (req, res) {
        res.sendFile('/examples/ar_simple/test/orbit/index.html', {root: staticFolder});
    });

    app.get('/examples/ar_simple/gps', function (req, res) {
        res.sendFile('/examples/ar_simple/test/gps/index.html', {root: staticFolder});
    });

    app.get('/examples/ar_simple/image_front', function (req, res) {
        res.sendFile('/examples/ar_simple/test/image_front/index.html', {root: staticFolder});
    });

    app.get('/examples/ar_simple/image_server', function (req, res) {
        res.sendFile('/examples/ar_simple/test/image_server/index.html', {root: staticFolder});
    });

    app.get('/examples/ar_simple/hit_test', function (req, res) {
        res.sendFile('/examples/ar_simple/test/hit_test/index.html', {root: staticFolder});
    });

};