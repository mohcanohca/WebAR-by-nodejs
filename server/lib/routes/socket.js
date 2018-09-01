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
/*const patternCorners3D = [
    new cv.Point3(0, 0, 0),
    new cv.Point3(260, 0, 0),
    new cv.Point3(260, 206, 0),
    new cv.Point3(0, 206, 0)
];*/

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


//TODO  根据传感器信息计算状态转移矩阵φ
function calStatusTransition(rot) {
    let mat = new cv.Mat(12, 12, cv.CV_64F, 0);
    mat.set(0, 0, rot.at(0, 0));
    mat.set(0, 3, rot.at(0, 1));
    mat.set(0, 6, rot.at(0, 2));
    
    mat.set(1, 1, rot.at(0, 0));
    mat.set(1, 4, rot.at(0, 1));
    mat.set(1, 7, rot.at(0, 2));
    
    mat.set(2, 2, rot.at(0, 0));
    mat.set(2, 5, rot.at(0, 1));
    mat.set(2, 8, rot.at(0, 2));
    
    mat.set(3, 0, rot.at(1, 0));
    mat.set(3, 3, rot.at(1, 1));
    mat.set(3, 6, rot.at(1, 2));
    
    mat.set(4, 1, rot.at(1, 0));
    mat.set(4, 4, rot.at(1, 1));
    mat.set(4, 7, rot.at(1, 2));
    
    mat.set(5, 2, rot.at(1, 0));
    mat.set(5, 5, rot.at(1, 1));
    mat.set(5, 8, rot.at(1, 2));
    
    mat.set(6, 0, rot.at(2, 0));
    mat.set(6, 3, rot.at(2, 1));
    mat.set(6, 6, rot.at(2, 2));
    
    mat.set(7, 1, rot.at(2, 0));
    mat.set(7, 4, rot.at(2, 1));
    mat.set(7, 7, rot.at(2, 2));
    
    mat.set(8, 2, rot.at(2, 0));
    mat.set(8, 5, rot.at(2, 1));
    mat.set(8, 8, rot.at(2, 2));
    
    mat.set(9, 9, rot.at(0, 0));
    mat.set(9, 10, rot.at(0, 1));
    mat.set(9, 11, rot.at(0, 2));
    
    mat.set(10, 9, rot.at(1, 0));
    mat.set(10, 10, rot.at(1, 1));
    mat.set(10, 11, rot.at(1, 2));
    
    mat.set(11, 9, rot.at(2, 0));
    mat.set(11, 10, rot.at(2, 1));
    mat.set(11, 11, rot.at(2, 2));
    
    return φ;
}

//根据视觉跟踪solvePnP得到的pose，转换成状态向量，用于卡尔曼滤波的输入
function calVisionStatus(pose) {
    let tempMat = new cv.Mat(1, 3, cv.CV_64F);//1x3的矩阵
    let rmat = null;
    tempMat.set(0, 0, pose.rvec.x);
    tempMat.set(0, 1, pose.rvec.y);
    tempMat.set(0, 2, pose.rvec.z);
    
    //5. 将输出的旋转向量转变为旋转矩阵
    rmat = tempMat.rodrigues();
    let arr = []
    for (let i = 0; i < 3; i++) {
        arr.push([rmat.dst.at(i, 0), rmat.dst.at(i, 1), rmat.dst.at(i, 2)]);//旋转矩阵
    }
    arr.push(pose.tvec.x, pose.tvec.y, pose.tvec.z);
    let status = new cv.Mat(12, 1, cv.CV_64F, arr);
    
    return status;
}

//卡尔曼滤波

function KalmanFilter() {
    /**
     * 卡尔曼滤波器
     * @param Z 观测值 一维数组
     * @param F 状态转移矩阵 二维数组
     */
    let x_0 = $V([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    let P_0 = $M([
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ]
    );
    let F_k = $M(F);//状态转移矩阵
    let Q_k = $M([
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ]
    );
    let KM = new KalmanModel(x_0, P_0, F_k, Q_k);
    
    let z_k = $V(Z);//观测向量
    let H_k = Matrix.I(12);//观测矩阵
    let R_k = $M([[4]]);//观测噪声方差
    let KO = new KalmanObservation(z_k, H_k, R_k);
    
    
    KM.F_k = calStatusTransition();//实时更新状态转移矩阵
    KO.z_k = z_k;
    KM.update(KO);
    console.log(JSON.stringify(KM.x_k.elements));
}


/**
 * 根据imu信息计算转换信息
 * @param rotation imu旋转信息
 * @param period
 * @returns {{rMat: Mat, tMat: {tx: number, ty: number, tz: number}}}
 */
function calTransformByIMU(rotation, period) {
    console.log('imu加速度：' + rotation.accelerate.x, rotation.accelerate.y, rotation.accelerate.z);
    console.log('imu旋转角速度：' + rotation.rx, rotation.ry, rotation.rz);
    
    //a. 根据绕各个轴的加速度，双重积分得出在各个轴的平移量
    let tx = rotation.accelerate.x * period * Math.pow(0.100, 2) / 2;
    let ty = rotation.accelerate.y * period * Math.pow(0.100, 2) / 2;
    let tz = rotation.accelerate.z * period * Math.pow(0.100, 2) / 2;
    
    //b. 计算旋转角，旋转速率是度/s
    let angle_z = rotation.rz * period;
    let angle_y = rotation.ry * period;
    let angle_x = rotation.rx * period;
    
    console.log('imu平移量：' + tx, ty, tz);
    console.log('imu旋转角度：' + angle_x, angle_y, angle_z);
    
    //由在x轴的旋转角计算在x轴的旋转矩阵
    let arr_x = [
        [1, 0, 0],
        [0, Math.cos(angle_x), -Math.sin(angle_x)],
        [0, Math.sin(angle_x), Math.cos(angle_x)],
    ];
    
    //由在y轴的旋转角计算在y轴的旋转矩阵
    let arr_y = [
        [Math.cos(angle_y), 0, Math.sin(angle_y)],
        [0, 1, 0],
        [-Math.sin(angle_y), 0, Math.cos(angle_y)],
    ];
    
    //由在z轴的旋转角计算在z轴的旋转矩阵
    let arr_z = [
        [Math.cos(angle_z), -Math.sin(angle_z), 0],
        [Math.sin(angle_z), Math.cos(angle_z), 0],
        [0, 0, 1],
    ];
    
    //上面三个旋转矩阵相乘，得出最终的旋转矩阵（由于不知道矩阵乘法如何使用，此处手动计算相乘结果，直接设置了结果）
    let temRot = new cv.Mat(3, 3, cv.CV_64F);
    temRot.set(0, 0, Math.cos(angle_y) * Math.cos(angle_z));
    temRot.set(0, 1, -Math.cos(angle_y) * Math.sin(angle_z));
    temRot.set(0, 2, Math.sin(angle_y));
    temRot.set(1, 0, Math.sin(angle_x) * Math.sin(angle_y) * Math.cos(angle_z) + Math.cos(angle_x) * Math.sin(angle_z));
    temRot.set(1, 1, -Math.sin(angle_x) * Math.sin(angle_y) * Math.sin(angle_z) * Math.cos(angle_z) + Math.cos(angle_x) * Math.cos(angle_z));
    temRot.set(1, 2, -Math.sin(angle_x) * Math.cos(angle_y));
    temRot.set(2, 0, -Math.cos(angle_x) * Math.sin(angle_y) * Math.cos(angle_z) + Math.sin(angle_x) * Math.sin(angle_z));
    temRot.set(2, 1, Math.cos(angle_x) * Math.sin(angle_y) * Math.sin(angle_z) + Math.sin(angle_x) * Math.cos(angle_z));
    temRot.set(2, 2, Math.cos(angle_x) * Math.cos(angle_y));
    
    
    //打印出由imu旋转角得到的旋转信息，mat3x3
    for (let i = 0; i < temRot.rows; i++) {
        console.log(temRot.at(i, 0), temRot.at(i, 1), temRot.at(i, 2));
    }
    
    return {
        rMat: temRot,
        tMat: {
            tx,
            ty,
            tz
        }
    };
}

module.exports = function (socket) {
    //旋转矩阵
    let rmat = null;//视觉跟踪计算出的世界坐标系到相机坐标系的旋转矩阵
    let initial_flag = true;
    let initial_rotation = null;
    let initial_transition = null;
    
    let pre_time = null;//上一次收到imu信息的时间
    let pre_imu = null;//上一次收到的imu信息
    
    socket.on('VIDEO_MESS', function (data) {
        let json = JSON.parse(data);
        
        frame_count++;//收到的帧的数量递增
        
        //3.四个特征点在图像上的对应点坐标，需要与特征点的世界坐标相对应
        let dstPosition = processBase64(json.imgData);
        
        if (!dstPosition)
            return;
        let points = [];//存储模板图四个角点的坐标，顺时针存储，返回前端四个点的坐标，用来测试
        
        let imageCorners = [];//存储模板图四个角点的坐标，顺时针存储
        
        let pose;
        
        //将模板图四个顶点在当前帧中的坐标信息进行格式转换，便于下面的计算
        for (let i = 0; i < dstPosition.rows; i++) {
            for (let j = 0; j <= dstPosition.cols - 1; j++) {
                imageCorners.push(
                    new cv.Point2(dstPosition.at(i, j).x, dstPosition.at(i, j).y)
                );
                points.push({
                    x: dstPosition.at(i, j).x,
                    y: dstPosition.at(i, j).y
                })
            }
        }
        
        /*        let testImgCorners = [];
                testImgCorners.push(new cv.Point2(19.029024229043806, 60.09270408444989));
                testImgCorners.push(new cv.Point2(238.7629101350634, 52.73370044713766));
                testImgCorners.push(new cv.Point2(269.1268284889731, 224.09107863021146));
                testImgCorners.push(new cv.Point2(-2.093814115868016, 233.98856405012896));*/
        
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
            
            console.log("旋转向量：")
            console.log(pose.rvec);
            
            
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
            position: points,
            pose: pose,
            rotation: rotation,
            // rotation: rotation_matrix,//旋转矩阵
            transition: pose.tvec//平移向量
            
        })
        ;
    });
    
    //处理IMU信息：旋转角度
    socket.on('IMU_MESS', function (data) {
        //    1. 将各个轴的旋转角转换成旋转矩阵，再相乘得到最终的旋转矩阵
        let cur_imu = JSON.parse(data);
        let cur_time = (new Date()).getTime();
        let pre_position=position;
        if (!pre_time) pre_time = cur_time;
        if (!pre_imu) pre_imu = cur_imu;
        
        let period = cur_time - pre_time;
        //根据各个轴的旋转角速度，单重积分，计算各个轴的旋转角
        
        let transform = calTransformByIMU(pre_imu, period);
        
        
        
        pre_time = cur_time;//计算完成后更新上一时刻的时间
        pre_imu = cur_imu;//更新上一次的旋转信息
        
        //    直接使用计算出的旋转信息作为计算状态转移矩阵φ的输入。
        
    });
}