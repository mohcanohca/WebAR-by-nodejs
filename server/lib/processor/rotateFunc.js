const cv = require('opencv4nodejs');

function codeRotateByZ(point, thetaz) {
    let tx, ty;
    let rz = thetaz * Math.PI / 180;
    tx = Math.cos(rz) * point.x - Math.sin(rz) * point.y;
    ty = Math.sin(rz) * point.x + Math.cos(rz) * point.y;
    return new cv.Point3(tx, ty, point.z)
}

function codeRotateByY(point, thetay) {
    let tx, tz;
    let ry = thetay * Math.PI / 180;
    tx = Math.cos(ry) * point.x + Math.sin(ry) * point.z;
    tz = Math.cos(ry) * point.z - Math.sin(ry) * point.x;
    return new cv.Point3(tx, point.y, tz)
}

function codeRotateByX(point, thetax) {
    let ty, tz;
    let rx = thetax * Math.PI / 180;
    ty = Math.cos(rx) * point.y - Math.sin(rx) * point.z;
    tz = Math.cos(rx) * point.z + Math.sin(rx) * point.y;
    return new cv.Point3(point.x, ty, tz)
}

exports.rotate={
    byX:codeRotateByX,
    byY:codeRotateByY,
    byZ:codeRotateByZ,
}