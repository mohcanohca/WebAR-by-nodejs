// import {Point3} from "../../../opencv4nodejs/lib";

const cv = require('opencv4nodejs'),
    async = require('async'),
    fs = require('fs');

const imgcodecs = require('../processor/imgcodecs');
const img1 = cv.imread('./data/banana.jpg');
const orbDetector = new cv.SIFTDetector({ nFeatures: 500 });
const grayimg1 = img1.bgrToGray();
const keyPoints1 = orbDetector.detect(grayimg1);
const descriptors1 = orbDetector.compute(grayimg1, keyPoints1);


//1.相机标定
// 1.1相机内参
const cameraMatrix = new cv.Mat([
    [1474.201173973207, 0, 324.7410445278369],
    [0, 1476.098111665499, 170.2674625579945],
    [0, 0, 1]
], cv.CV_32F);
//1.2相机畸变系数
const distCoeffs = [-0.003658734119394942, 16.7106159844306, -0.0353842305746363, -0.01350585239506857, -639.137482560104];
//2.四个特征点的世界坐标，此处选取的是模板图四个顶点
/*const patternCorners3D = [
    new cv.Point3(0, 0, 0),
    new cv.Point3( 0, img1.cols,0),
    new cv.Point3( img1.rows,img1.cols, 0),
    new cv.Point3(img1.rows, 0, 0),
]*/
const patternCorners3D = [

    new cv.Point3(-img1.cols/2, img1.rows/2, 0),
    new cv.Point3(img1.cols/2, img1.rows/2, 0),
    new cv.Point3(img1.cols/2, -img1.rows/2, 0),
    new cv.Point3(-img1.cols/2, -img1.rows/2, 0)

]

// let dstCoordinates;


let rmat;

function codeRotateByZ(point, thetaz) {
    let tx, ty;
    let rz = thetaz * Math.PI / 180;
    tx = Math.cos(rz) * point.x - Math.sin(rz) * point.y;
    ty = Math.sin(rz) * point.x - Math.cos(rz) * point.y;
    return new cv.Point3(tx, ty, point.z)
}

function codeRotateByY(point, thetay) {
    let tx, tz;
    let ry = thetay * Math.PI / 180;
    tx = Math.cos(ry) * point.x - Math.sin(ry) * point.z;
    tz = Math.cos(ry) * point.z - Math.sin(ry) * point.x;
    return new cv.Point3(tx, point.y, tz)
}

function codeRotateByX(point, thetax) {
    let ty, tz;
    let rx = thetax * Math.PI / 180;
    ty = Math.cos(rx) * point.y - Math.sin(rx) * point.z;
    tz = Math.sin(rx) * point.z - Math.cos(rx) * point.y;
    return new cv.Point3(point.x, ty, tz)
}

const matchFeatures = ({img1, img2, detector, matchFunc}) => {
    // let grayimg1=img1.bgrToGray();
    let grayimg2 = img2.bgrToGray();
    // 检测特征点
    // const keyPoints1 = detector.detect(grayimg1);
    const keyPoints2 = detector.detect(grayimg2);

    // 计算特征点描述符
    // const descriptors1 = detector.compute(grayimg1, keyPoints1);
    const descriptors2 = detector.compute(grayimg2, keyPoints2);

    let dstCoordinates;//四个特征点在图像上的对应点坐标，需要与特征点的世界坐标相对应

    try {
        if (descriptors1 && descriptors2) {
                // 特征点匹配
                const matches = matchFunc(descriptors1, descriptors2);


                // only keep good matches
                const bestN = 40;
                const bestMatches = matches.sort(
                    (match1, match2) => match1.distance - match2.distance
                ).slice(0, bestN);

                //存放取出的特征点信息
                let points1 = [];
                let points2 = [];
            for (let match of bestMatches) {
                points1.push(keyPoints1[match.queryIdx].point);
                points2.push(keyPoints2[match.trainIdx].point);
            }

            /*    let corners1=[];
                let corners2=[];

                corners1.push(new cv.Point2(0,0));
                corners1.push(new cv.Point2(0,img1.cols));
                corners1.push(new cv.Point2(img1.rows,0));
                corners1.push(new cv.Point2(img1.rows,img1.cols));*/


            let mask = new cv.Mat();
            //计算img2和img1的单应性变换矩阵homo
            let transform = cv.findHomography(points1, points2, {
                method: cv.RANSAC,
                ransacReprojThreshold: 5,
                mask: mask
            });
            // console.log(transform.homography);
            /*    for(let i=0;i<3;i++){
                    for(let j=0;j<3;j++){
                        // console.log(transform.homography.at(i,j));
                    }
                }*/
            // console.log(transform.mask);

            const srcCorners = new cv.Mat([[
                [0, 0],
                [img1.cols, 0],
                [img1.cols, img1.rows],
                [0, img1.rows]
            ]], cv.CV_32FC2);
            // console.log(srcCorners)
            dstCoordinates = srcCorners.perspectiveTransform(transform.homography)
        }
        return dstCoordinates;
    } catch (e) {
        return undefined
    }


    /*return cv.drawMatches(
        img1,
        img2,
        keyPoints1,
        keyPoints2,
        bestMatches
    );*/
};
const processBase64 = (base64) => {
    //解码得到视频帧
    let img2 = imgcodecs.decodeFromBase64(base64);
    // let orbMatchesImg = matchFeatures({

    //获取点的世界坐标在图像上的对应点坐标
    let dstPosition = matchFeatures({
        img1,
        img2,
        detector: orbDetector,
        //返回class DescriptorMatch {
        //   readonly queryIdx: number;
        //   readonly trainIdx: number;
        //   readonly distance: number;
        // }
        // matchFunc: cv.matchBruteForceHamming
        matchFunc: cv.matchFlannBased
    });
    // console.log(orbMatchesImg);

    // cv.imshowWait('ORB matches', orbMatchesImg);
    return dstPosition;
}
module.exports = function (socket) {
    socket.on('devicemess', function (data) {
        let json = JSON.parse(data);
        // console.log(json.imuData);

        //保存收到的base64为图片文件，主要用于测试
        /*var output = base64.replace(/^data:image\/(png|jpeg);base64,/, "");
        var buffer = new Buffer(output, 'base64');
        fs.writeFile("image.png", buffer, function(err) {
            if(err){
                console.log(err)
            }else{
                console.log("保存成功！");
            }
        });*/

        //3.四个特征点在图像上的对应点坐标，需要与特征点的世界坐标相对应
        // let dstPosition = processBase64(base64);
        let dstPosition = processBase64(json.imgData);
        if (!dstPosition)
            return;
        let points = [];//存储模板图四个角点的坐标，顺时针存储，返回前端四个点的坐标，用来测试
        let imageCorners = [];//存储模板图四个角点的坐标，顺时针存储
        let pose;

        //将模板图四个顶点在当前帧中的坐标信息进行格式转换，便于下面的计算
        for (let i = 0; i < dstPosition.rows; i++) {
            for (let j = dstPosition.cols - 1; j >= 0; j--) {
                imageCorners.push(
                    new cv.Point2(dstPosition.at(i, j).x, dstPosition.at(i, j).y)
                );
                // console.log(dstPosition.at(i,j).x,dstPosition.at(i,j).y);
                points.push({
                    x: dstPosition.at(i, j).x,
                    y: dstPosition.at(i, j).y
                })
            }
        }

        if (dstPosition) {

            //4. 求出旋转向量rvec和平移向量tvec
            pose = cv.solvePnP(patternCorners3D, imageCorners, cameraMatrix, distCoeffs);
            // console.log(pose.rvec);
            // console.log(pose.tvec);

            //由于rodrigues是Mat的方法，需要先将Vec转换成Mat
            let tempMat = new cv.Mat(1, 3, cv.CV_32F);//1x3的矩阵
            tempMat.set(0, 0, pose.rvec.z);
            tempMat.set(0, 1, pose.rvec.y);
            tempMat.set(0, 2, pose.rvec.x);

//            验证Rodrigues变换正误的数据
            /*                        tempMat.set(0, 0, -2.100418);
                                    tempMat.set(0, 1, -2.167796);
                                    tempMat.set(0, 2,  0.273330);*/
            /*
            -0.03625444695353508
            0.978363573551178
            -0.20369188487529755
            0.9983044266700745
            0.02616826631128788
            -0.051994688808918
            -0.04553944617509842
            -0.20523156225681305
            -0.9776533842086792
            * */

            //5. 将输出的旋转向量转变为旋转矩阵
            rmat = tempMat.rodrigues();
            // console.log(rmat.dst);//旋转矩阵
            // console.log(rmat.jacobian);//jacobian矩阵

            let r11 = rmat.dst.at(0, 0),
                r21 = rmat.dst.at(1, 0),
                r31 = rmat.dst.at(2, 0),
                r32 = rmat.dst.at(2, 1),
                r33 = rmat.dst.at(2, 2);
            //6. 求出相机的三个旋转角
            let thetaz = Math.atan2(r21, r11) / Math.PI * 180;
            let thetay = Math.atan2(-1 * r31, Math.sqrt(r32 * r32 + r33 * r33)) / Math.PI * 180;
            let thetax = Math.atan2(r32, r33) / Math.PI * 180;
            let rotate = {
                thetax: thetax,
                thetay: thetay,
                thetaz: thetaz,
            }
            console.log(rotate);

            //根据旋转角度求相机在世界坐标系中的位置
            //相机在世界坐标系中的初始位置
            // let p0=new cv.Point3(0,0,50);
            let p0 = new cv.Point3(0, 0, 50);
            let p1 = codeRotateByZ(p0, -thetaz);
            let p2 = codeRotateByY(p1, -thetay);
            let p3 = codeRotateByX(p2, -thetax);

            //世界坐标系中相机的位置坐标为(-p3.x,-p3.y,-p3.z)
            console.log(-p3.x, -p3.y, -p3.z);
        }

        socket.emit('frame', {
            position: points,
            pose: pose
        });
    })
}