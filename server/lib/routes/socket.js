const cv = require('opencv4nodejs'),
    async = require('async'),
    fs = require('fs');

require('../processor/sylvester.src');
require('../processor/kalman');

const imgcodecs = require('../processor/imgcodecs');
const imgDescriber = require('../processor/imgDescriber');
const rotateFunc = require('../processor/rotateFunc');
//1.相机标定
const camera = require('../config/camera_param');
const pattern = cv.imread('./data/pattern.jpg');

let frame_count = 0;//记录收到的帧的数量

//模板图描述
const pattern_info_orb = imgDescriber.orb_describe(pattern);
const pattern_info_sift = imgDescriber.sift_describe(pattern);

let targetHomoGraphy = null;//最终目标：模型与当前帧的单应性矩阵
let videoHomoGraphy = null;//根据视觉跟踪得出的模型与当前帧的单应性矩阵

//2.四个特征点的世界坐标，此处选取的是模板图四个顶点
const patternCorners3D = [
    new cv.Point3(44, 25, 0),
    new cv.Point3(257, 25, 0),
    new cv.Point3(257, 184, 0),
    new cv.Point3(44, 184, 0)
];


//特征点匹配
const matchFeatures = ({img1, img2, matchFunc}) => {
    let frame_info = null;
    let pattern_info = null;
    if (frame_count === 20) {
        frame_info = imgDescriber.sift_describe(img2);//每隔20帧使用sift描述计算一次
        pattern_info = pattern_info_sift;
        frame_count = 0;//重新新一轮
    } else {
        frame_info = imgDescriber.orb_describe(img2);
        pattern_info = pattern_info_orb;
    }


    let dstCoordinates;//四个特征点在图像上的对应点坐标，需要与特征点的世界坐标相对应

    try {
        if (pattern_info.descriptors && frame_info.descriptors) {
            // 特征点匹配
            const matches = matchFunc(pattern_info.descriptors, frame_info.descriptors);

            // 保留最匹配的bestN个点
            const bestN = 50;
            const bestMatches = matches.sort(
                (match1, match2) => match1.distance - match2.distance
            ).slice(0, bestN);

            //存放取出的特征点信息
            let points1 = [];
            let points2 = [];
            for (let match of bestMatches) {
                points1.push(pattern_info.keyPoints[match.queryIdx].point);
                points2.push(frame_info.keyPoints[match.trainIdx].point);
            }

            let mask = new cv.Mat();
            //计算img2和img1的单应性变换矩阵homo
            let transform = cv.findHomography(points1, points2, {
                method: cv.RANSAC,
                ransacReprojThreshold: 5,
                mask: mask
            });

            videoHomoGraphy = transform.homography;

            //模板图上选取的四个点（此处为图像的四个角点）
            const srcCorners = new cv.Mat([[
                [0, 0],
                [img1.cols, 0],
                [img1.cols, img1.rows],
                [0, img1.rows]

            ]], cv.CV_64FC2);

            //得到模板图的四个点在当前帧中的坐标
            dstCoordinates = srcCorners.perspectiveTransform(videoHomoGraphy);
        }
        return dstCoordinates;
    } catch (e) {
        return undefined
    }
};

//处理base64编码的当前帧，在帧中找到跟踪对象的位置
const processBase64 = (base64) => {
    //解码得到视频帧
    let frame = imgcodecs.decodeFromBase64(base64);
    let matchFunc = cv.matchBruteForceHamming;
    if (frame_count === 20) {
        matchFunc = cv.matchFlannBased;
    }
    // let orbMatchesImg = matchFeatures({

    //获取点的世界坐标在图像上的对应点坐标
    let dstPosition = matchFeatures({
        img1: pattern,
        img2: frame,
        // matchFunc: cv.matchFlannBased//找到最近邻近似匹配，需要找到一个相对好的匹配但是不需要最佳匹配的时使用
        // matchFunc: cv.matchBruteForceHamming//找最佳匹配
        matchFunc,
    });
    return dstPosition;
}

module.exports = function (socket) {
    //旋转矩阵
    let rmat = null;//视觉跟踪计算出的世界坐标系到相机坐标系的旋转矩阵
    let initial_flag = true;
    let initial_rotation = null;
    let initial_transition = null;

    /* let pre_time = null;//上一次收到imu信息的时间
     let pre_imu = null;//上一次收到的imu信息*/

    socket.on('VIDEO_MESS', function (data) {
        let json = JSON.parse(data);

        frame_count++;//收到的帧的数量递增

        //3.四个特征点在图像上的对应点坐标，需要与特征点的世界坐标相对应
        let dstPosition = processBase64(json.imgData);

        if (!dstPosition)
            return;
        let corners = [];//存储模板图四个角点的坐标，顺时针存储，返回前端四个点的坐标，用来测试

        let imageCorners = [];//存储模板图四个角点的坐标，顺时针存储

        let pose;

        //将模板图四个顶点在当前帧中的坐标信息进行格式转换，便于下面的计算
        for (let i = 0; i < dstPosition.rows; i++) {
            for (let j = 0; j <= dstPosition.cols - 1; j++) {
                imageCorners.push(
                    new cv.Point2(dstPosition.at(i, j).x, dstPosition.at(i, j).y)
                );
                corners.push({
                    x: dstPosition.at(i, j).x,
                    y: dstPosition.at(i, j).y
                })
            }
        }

        let rotation;

        if (dstPosition) {

            //4. 求出旋转向量rvec和平移向量tvec
            pose = cv.solvePnP(patternCorners3D, imageCorners, camera.param.matrix, camera.param.dist, false, cv.SOLVEPNP_P3P);
            // pose = cv.solvePnP(patternCorners3D, testImgCorners, camera.param.matrix, camera.param.dist);

            //由于rodrigues是Mat的方法，需要先将Vec转换成Mat
            let tempMat = new cv.Mat(1, 3, cv.CV_64F);//1x3的矩阵
            tempMat.set(0, 0, pose.rvec.x);
            tempMat.set(0, 1, pose.rvec.y);
            tempMat.set(0, 2, pose.rvec.z);


            //5. 将输出的旋转向量转变为旋转矩阵
            rmat = tempMat.rodrigues();
            if (initial_flag) {
                initial_rotation = rmat;
                initial_transition = pose.rvec;
                initial_flag = false;
                console.log("视觉得到初始旋转矩阵为：");
                for (let i = 0; i < 3; i++) {
                    console.log(rmat.dst.at(i, 0), rmat.dst.at(i, 1), rmat.dst.at(i, 2));//旋转矩阵
                }
                console.log("视觉得到初始平移向量为：");
                console.log(pose.tvec);
            }

            /*for (let i = 0; i < 3; i++) {
                console.log(rmat.dst.at(i, 0), rmat.dst.at(i, 1), rmat.dst.at(i, 2));//旋转矩阵
            }*/

            // console.log(rmat.jacobian);//jacobian矩阵

            //根据旋转矩阵R和平移矩阵T，求相机在世界坐标系中的位置
            let r11 = rmat.dst.at(0, 0),
                r21 = rmat.dst.at(1, 0),
                r31 = rmat.dst.at(2, 0),
                r32 = rmat.dst.at(2, 1),
                r33 = rmat.dst.at(2, 2);

            //6. 求出相机的三个旋转角
            let thetaz = Math.atan2(r21, r11) / Math.PI * 180;
            let thetay = Math.atan2(-1 * r31, Math.sqrt(r32 * r32 + r33 * r33)) / Math.PI * 180;
            let thetax = Math.atan2(r32, r33) / Math.PI * 180;

            rotation = {
                thetax: thetax,
                thetay: thetay,
                thetaz: thetaz,
            };

            //根据旋转角度求相机在世界坐标系中的位置
            //相机在世界坐标系中的初始位置
            // let p0=new cv.Point3(0,0,50);
            let p0 = new cv.Point3(pose.tvec.x, pose.tvec.y, pose.tvec.z);
            let p1 = rotateFunc.rotate.byZ(p0, -thetaz);
            let p2 = rotateFunc.rotate.byY(p1, -thetay);
            let p3 = rotateFunc.rotate.byX(p2, -thetax);

            /*console.log("平移向量：")
            console.log(pose.tvec);
            //世界坐标系中相机的位置坐标为(-p3.x,-p3.y,-p3.z)
            console.log("位置：")
            console.log(-p3.x, -p3.y, -p3.z);*/
        }

        let rotation_matrix = [
            [rmat.dst.at(0, 0), rmat.dst.at(0, 1), rmat.dst.at(0, 2)],
            [rmat.dst.at(1, 0), rmat.dst.at(1, 1), rmat.dst.at(1, 2)],
            [rmat.dst.at(2, 0), rmat.dst.at(2, 1), rmat.dst.at(2, 2)],
        ];
        let transition_arr = [
            pose.tvec.x, pose.tvec.y, pose.tvec.z
        ];

        socket.emit('frame', {
            corners: corners,
            pose: pose,
            rotation: rotation,
            transition: pose.tvec//平移向量
        })
        ;
    });
}