
var FeatTrainer =  (function () {
    function FeatTrainer() {
        this.patternSize = 640;
        this.levels = 4;
        this.keyPointsPerlevel = 400;
        this.blurSize = 5;
        this.matchThreshold = 48;
        this._imgU8Smooth = new jsfeat.matrix_t(1, 1, jsfeat.U8_t | jsfeat.C1_t);
        this._screenCorners = [];
    }
    FeatTrainer.prototype._configParameters = function () {
        jsfeat.yape06.laplacian_threshold = 30;
        jsfeat.yape06.min_eigen_value_threshold = 25;
    };
    FeatTrainer.prototype.findTransform = function (matches, screenKeyPoints, patternKeyPoints) {
        var mm_kernel = new jsfeat.motion_model.affine2d();
        // ransac params
        var num_model_points = 4;
        var reproj_threshold = 3;
        var ransac_param = new jsfeat.ransac_params_t(num_model_points, reproj_threshold, 0.5, 0.99);
        var pattern_xy = [];
        var screen_xy = [];
        var count = matches.length;
        // construct correspondences
        for (var i = 0; i < count; ++i) {
            var m = matches[i];
            var s_kp = screenKeyPoints[m.screen_idx];
            var p_kp = patternKeyPoints[m.pattern_lev][m.pattern_idx];
            pattern_xy[i] = { x: p_kp.x, y: p_kp.y };
            screen_xy[i] = { x: s_kp.x, y: s_kp.y };
        }
        // estimate motion
        var homo3x3 = new jsfeat.matrix_t(3, 3, jsfeat.F32C1_t);
        var match_mask = new jsfeat.matrix_t(this.keyPointsPerlevel, 1, jsfeat.U8C1_t);
        var ok = jsfeat.motion_estimator.ransac(ransac_param, mm_kernel, pattern_xy, screen_xy, count, homo3x3, match_mask, 1000);
        // extract good matches and re-estimate
        var good_cnt = 0;
        if (ok) {
            for (var i = 0; i < count; ++i) {
                if (match_mask.data[i]) {
                    pattern_xy[good_cnt].x = pattern_xy[i].x;
                    pattern_xy[good_cnt].y = pattern_xy[i].y;
                    screen_xy[good_cnt].x = screen_xy[i].x;
                    screen_xy[good_cnt].y = screen_xy[i].y;
                    good_cnt++;
                }
            }
            // run kernel directly with inliers only
            mm_kernel.run(pattern_xy, screen_xy, homo3x3, good_cnt);
            return { transform: homo3x3, goodMatch: good_cnt };
        }
    };
    FeatTrainer.prototype.getGrayScaleMat = function (img) {
        var width, height, imageData;
        if (img instanceof Image || img instanceof HTMLImageElement) {

            width = img.naturalWidth;
            height = img.naturalHeight;
            var ctx = getCanvasContext(width, height);
            ctx.drawImage(img, 0, 0, width, height);
            imageData = ctx.getImageData(0, 0, width, height).data;

        }
        else {
            width = img.width;
            height = img.height;
            imageData = img.data;
        }
        var target;
        if (imageData.length === width * height * 4) {
            target = new jsfeat.matrix_t(width, height, jsfeat.U8_t | jsfeat.C1_t);
            jsfeat.imgproc.grayscale(imageData, width, height, target);
        }
        else if (imageData.length === width * height) {
            target = new jsfeat.matrix_t(width, height, jsfeat.U8_t | jsfeat.C1_t, { u8: imageData });
        }
        return target;
    };
    FeatTrainer.prototype.createMatFromUint8Array = function (width, height, bytes) {
        return new jsfeat.matrix_t(width, height, jsfeat.U8_t | jsfeat.C1_t, { u8: bytes });
    };
    FeatTrainer.prototype.matchPattern = function (screen_descriptors, pattern_descriptors) {
        var q_cnt = screen_descriptors.rows;
        var query_u32 = screen_descriptors.buffer.i32;
        var qd_off = 0;
        var qidx = 0, lev = 0, pidx = 0, k = 0;
        var match_threshold = this.matchThreshold;
        var num_train_levels = this.levels;
        var matches = [];
        for (qidx = 0; qidx < q_cnt; ++qidx) {
            var best_dist = 256;
            var best_dist2 = 256;
            var best_idx = -1;
            var best_lev = -1;
            for (lev = 0; lev < num_train_levels; ++lev) {
                var lev_descr = pattern_descriptors[lev];
                var ld_cnt = lev_descr.rows;
                var ld_i32 = lev_descr.buffer.i32; // cast to integer buffer
                var ld_off = 0;
                for (pidx = 0; pidx < ld_cnt; ++pidx) {
                    var curr_d = 0;
                    // our descriptor is 32 bytes so we have 8 Integers
                    for (k = 0; k < 8; ++k) {
                        curr_d += popcnt32(query_u32[qd_off + k] ^ ld_i32[ld_off + k]);
                    }
                    if (curr_d < best_dist) {
                        best_dist2 = best_dist;
                        best_dist = curr_d;
                        best_lev = lev;
                        best_idx = pidx;
                    }
                    else if (curr_d < best_dist2) {
                        best_dist2 = curr_d;
                    }
                    ld_off += 8; // next descriptor
                }
            }
            // filter out by some threshold
            if (best_dist < match_threshold) {
                matches.push({
                    screen_idx: qidx,
                    pattern_lev: best_lev,
                    pattern_idx: best_idx
                });
            }
            qd_off += 8; // next query descriptor
        }
        return matches;
    };
    FeatTrainer.prototype.describeFeatures = function (img_u8) {
        var img_u8_smooth = this._imgU8Smooth;
        var screen_corners = this._screenCorners;
        if (img_u8_smooth.cols !== img_u8.cols || img_u8_smooth.rows !== img_u8.rows) {
            img_u8_smooth.resize(img_u8.cols, img_u8.rows, img_u8.channel);
            var i = img_u8.cols * img_u8.rows;
            while (i-- > 0) {
                screen_corners[i] = {};
            }
        }
        jsfeat.imgproc.gaussian_blur(img_u8, img_u8_smooth, this.blurSize);
        var max_per_level = this.keyPointsPerlevel;
        var num_corners = this.detectKeyPoints(img_u8_smooth, screen_corners, max_per_level);
        var descriptors = new jsfeat.matrix_t(32, max_per_level, jsfeat.U8_t | jsfeat.C1_t);
        jsfeat.orb.describe(img_u8_smooth, screen_corners, num_corners, descriptors);
        return {
            keyPoints: screen_corners.slice(0, num_corners), descriptors: descriptors
        };
    };
    FeatTrainer.prototype.trainPattern = function (img_u8) {
        var max_pattern_size = this.patternSize;
        var num_train_levels = this.levels;
        var sc0 = Math.min(max_pattern_size / img_u8.cols, max_pattern_size / img_u8.rows, 1);
        var new_width = (img_u8.cols * sc0);
        var new_height = (img_u8.rows * sc0);
        var lev0_img = new jsfeat.matrix_t(img_u8.cols, img_u8.rows, jsfeat.U8_t | jsfeat.C1_t);
        var lev_img = new jsfeat.matrix_t(img_u8.cols, img_u8.rows, jsfeat.U8_t | jsfeat.C1_t);
        var pattern_corners = [], pattern_descriptors = [];
        var sc_inc = Math.sqrt(2.0);
        var sc = 1;
        var levels = [];
        this.resample(img_u8, lev0_img, new_width, new_height);
        for (var lev = 0; lev < num_train_levels; ++lev) {
            new_width = (lev0_img.cols * sc);
            new_height = (lev0_img.rows * sc);
            this.resample(lev0_img, lev_img, new_width, new_height);
            var result = this.describeFeatures(lev_img);
            result.keyPoints.forEach(function (k) {
                k.x /= sc;
                k.y /= sc;
            });
            pattern_corners[lev] = result.keyPoints;
            pattern_descriptors[lev] = result.descriptors;
            levels.push([new_width, new_height]);
            sc /= sc_inc;
        }
        return {
            keyPoints: pattern_corners,
            descriptors: pattern_descriptors,
            levels: levels
        };
    };
    FeatTrainer.prototype.resample = function (src, target, nw, nh) {
        nw = Math.round(nw);
        nh = Math.round(nh);
        var h = src.rows, w = src.cols;
        if (!target) {
            target = new jsfeat.matrix_t(nw, nh, jsfeat.U8_t | jsfeat.C1_t);
        }
        if (h > nh && w > nw) {
            jsfeat.imgproc.resample(src, target, nw, nh);
        }
        else {
            target.resize(nw, nh, src.channel);
            target.data.set(src.data);
        }
        return target;
    };
    FeatTrainer.prototype.detectKeyPoints = function (img, corners, max_allowed) {
        this._configParameters();
        var count = jsfeat.yape06.detect(img, corners, 17);
        // sort by score and reduce the count if needed
        if (count > max_allowed) {
            jsfeat.math.qsort(corners, 0, count - 1, function (a, b) {
                return (b.score < a.score);
            });
            count = max_allowed;
        }
        for (var i = 0; i < count; ++i) {
            corners[i].angle = ic_angle(img, corners[i].x, corners[i].y);
        }
        return count;
    };
    return FeatTrainer;
}());

var cvs;
function getCanvasContext(width, height) {
    if (!cvs) {
        cvs = document.createElement('canvas');
    }
    if (width && height) {
        cvs.width = width;
        cvs.height = height;
    }
    return cvs.getContext('2d');
}
function popcnt32(n) {
    n -= ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0xF0F0F0F) * 0x1010101) >> 24;
}
function ic_angle(img, px, py) {
    var half_k = 15; // half patch size
    var m_01 = 0, m_10 = 0;
    var src = img.data, step = img.cols;
    var u = 0, v = 0, center_off = (py * step + px) | 0;
    var v_sum = 0, d = 0, val_plus = 0, val_minus = 0;
    // Treat the center line differently, v=0
    for (u = -half_k; u <= half_k; ++u)
        m_10 += u * src[center_off + u];
    // Go line by line in the circular patch
    for (v = 1; v <= half_k; ++v) {
        // Proceed over the two lines
        v_sum = 0;
        d = u_max[v];
        for (u = -d; u <= d; ++u) {
            val_plus = src[center_off + u + v * step];
            val_minus = src[center_off + u - v * step];
            v_sum += (val_plus - val_minus);
            m_10 += u * (val_plus + val_minus);
        }
        m_01 += v * v_sum;
    }
    return Math.atan2(m_01, m_10);
}
var u_max = new Int32Array([15, 15, 15, 15, 14, 14, 14, 13, 13, 12, 11, 10, 9, 8, 6, 3, 0]);

