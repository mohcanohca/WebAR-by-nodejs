// modules
const express = require('express');
const http = require('http');
const https = require('https');
const morgan = require('morgan');
const fs = require('fs');

const options = {
    key: fs.readFileSync('./certificate/private.pem'),//私钥
    cert: [fs.readFileSync('./certificate/csr.crt')],//证书
};

// configuration files
var configServer = require('./lib/config/server_config');

// app parameters
var app = express();
// app.set('port', configServer.httpPort);
app.use(express.static(configServer.staticFolder));
app.use(morgan('dev'));

// serve index
require('./lib/routes').serveIndex(app, configServer.staticFolder);

// HTTP server
var server = http.createServer(app);
server.listen(8080, function () {
    // console.log('HTTP server listening on port ' + app.get('port'));
});


// WebSocket server
var io = require('socket.io')(server);
io.on('connection', require('./lib/routes/socket'));


let sserver = https.createServer(options, app);
sserver.listen(8081, function () {
    console.log('HTTPS server listening on port 8081');
});

// WebSocket server
var sio = require('socket.io')(sserver);
sio.on('connection', require('./lib/routes/socket'));

module.exports.app = app;