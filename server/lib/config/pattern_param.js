//模板图参数
// 1. 模板图路径
const pattern_path = './data/banana.jpg';

//2. 模板图的信息
const imgDescriber = require('../processor/imgDescriber');
const pattern_info = imgDescriber.describe(pattern);

//3.四个特征点的世界坐标，此处选取的是模板图四个顶点
const patternCorners3D = [
    new cv.Point3(44, 25, 0),
    new cv.Point3(257, 25, 0),
    new cv.Point3(257, 184, 0),
    new cv.Point3(44, 184, 0)
];
exports.param = {
    matrix: cameraMatrix,
    dist: distCoeffs,
}