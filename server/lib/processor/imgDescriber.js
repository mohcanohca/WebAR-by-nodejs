const cv = require('opencv4nodejs');

sift_describe = (image) => {
    const detector = new cv.SIFTDetector({nFeatures: 500});
    const grayImg = image.bgrToGray();
    const keyPoints = detector.detect(grayImg);
    const descriptors = detector.compute(grayImg, keyPoints);
    return {
        keyPoints: keyPoints,
        descriptors: descriptors,
    }
}

orb_describe = (image) => {
    const detector = new cv.ORBDetector();
    const grayImg = image.bgrToGray();
    const keyPoints = detector.detect(grayImg);
    const descriptors = detector.compute(grayImg, keyPoints);
    return {
        keyPoints: keyPoints,
        descriptors: descriptors,
    }
}

exports.sift_describe = sift_describe;
exports.orb_describe = orb_describe;

