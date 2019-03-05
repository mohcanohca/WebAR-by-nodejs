const cv = require('opencv4nodejs');
//1.相机标定
// 1.1相机内参
const cameraMatrix = new cv.Mat([
    [3215.626082522419, 0, 1471.556444548214],
    [0, 3222.051668804792, 1927.086879135644],
    [0, 0, 1]
], cv.CV_32F);

//1.2相机畸变系数
const distCoeffs = [0.4829911929113178, -2.098554567754686, -0.004550508970407664, -0.003201260898451633, 2.290223376487714];

exports.param={
    matrix:cameraMatrix,
    dist:distCoeffs,
}
