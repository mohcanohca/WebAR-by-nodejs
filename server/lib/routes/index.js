// Load the page
// NB: This needs to be the last route added
exports.serveIndex = function (app, staticFolder) {
    app.get('/', function (req, res) {
        res.sendFile('index.html', {root: staticFolder});
    });

    app.get('/examples/ar_simple', function (req, res) {
        res.sendFile('/examples/ar_simple/index.html', {root: staticFolder});
    });
    app.get('/webxr', function (req, res) {
        res.sendFile('/ar-with-webxr-master/step-05/index.html', {root: staticFolder});
    });

    app.get('/recognize',function (req,res) {
        //TODO 将图像识别能力以接口提供
    })
};