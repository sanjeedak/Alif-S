const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const { deleteFile, createOutputPath } = require('../utils/fileHelper'); 

// ==========================================
//  HELPER FUNCTIONS
// ==========================================

/**
 * Standard Promise Wrapper for FFmpeg
 * Handles command execution and error cleanup automatically.
 */
const processVideo = (inputPath, outputPath, commandBuilder) => {
    return new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath);
        
        // Apply specific logic passed from controller
        command = commandBuilder(command);

        command
            .outputOptions('-preset ultrafast') // Fast processing for editing
            .on('end', () => resolve(outputPath))
            .on('error', (err) => {
                console.error(`FFmpeg Error: ${err.message}`);
                // Cleanup the empty/corrupt file if processing failed
                deleteFile(outputPath);
                reject(new Error(`Processing Failed: ${err.message}`));
            })
            .save(outputPath);
    });
};

/**
 * ✅ DATABASE ENTRY HELPER (FIXED)
 * Converts absolute system paths to relative web paths before saving.
 * This ensures files work on the Frontend (http://localhost:5001/uploads/...)
 */
const saveVideoToDB = async (req, parentVideo, outputPath, label, format = null) => {
    // 1. Calculate Relative Path (from project root)
    // Example: C:\Users\Project\uploads\vn_123.mp4 -> uploads\vn_123.mp4
    const relativePath = path.relative(path.join(__dirname, '..'), outputPath);
    
    // 2. Force Forward Slashes (for URL compatibility on all OS)
    // Example: uploads\vn_123.mp4 -> uploads/vn_123.mp4
    const cleanPath = relativePath.replace(/\\/g, '/');

    return await Video.create({
        userId: req.user.id,
        parentId: parentVideo.id,
        title: `${label}: ${parentVideo.title}`,
        filename: path.basename(outputPath),
        filePath: cleanPath, // ✅ SAVING RELATIVE PATH
        size: fs.statSync(outputPath).size,
        format: format || parentVideo.format || 'mp4',
        thumbnail: parentVideo.thumbnail // Inherit thumbnail
    });
};

/**
 * Helper to get Absolute Path from Relative DB Path
 * FFmpeg requires absolute paths (e.g. C:/Users/...) to find the file.
 */
const getAbsolutePath = (relativePath) => {
    return path.join(__dirname, '../', relativePath);
};

// ==========================================
//  1. SMART UNDO / REMOVE EDIT LOGIC
// ==========================================

exports.removeLastEdit = async (req, res) => {
    const { id } = req.params;

    const currentVideo = await Video.findByPk(id);
    if (!currentVideo) { res.status(404); throw new Error('Video not found'); }

    // Check if it is an edited version (has a parent)
    if (!currentVideo.parentId) {
        res.status(400);
        throw new Error('Cannot Undo: This is the original file.');
    }

    const parentVideo = await Video.findByPk(currentVideo.parentId);
    if (!parentVideo) { res.status(404); throw new Error('Original version not found.'); }

    // Resolve absolute path to delete file from disk
    const absolutePath = getAbsolutePath(currentVideo.filePath);
    deleteFile(absolutePath);

    // Remove from DB
    await currentVideo.destroy();

    res.status(200).json({
        success: true,
        message: 'Edit undone successfully',
        data: parentVideo // Return parent so frontend can revert
    });
};

// ==========================================
//  2. VN STUDIO EDITING FEATURES
// ==========================================

exports.trimVideo = async (req, res) => {
    const { videoId, startTime, duration } = req.body;
    if (startTime === undefined || !duration) throw new Error('Start Time and Duration required');
    
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);

    await processVideo(inputPath, outputPath, (cmd) => 
        cmd.setStartTime(startTime).setDuration(duration)
    );

    const newVideo = await saveVideoToDB(req, video, outputPath, 'Trimmed');
    res.status(200).json({ success: true, data: newVideo });
};

exports.cropVideo = async (req, res) => {
    const { videoId, w, h, x, y } = req.body;
    if (!w || !h) throw new Error('Crop dimensions required');

    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);

    await processVideo(inputPath, outputPath, (cmd) => 
        cmd.videoFilters(`crop=${w}:${h}:${x}:${y}`)
    );

    const newVideo = await saveVideoToDB(req, video, outputPath, 'Cropped');
    res.status(200).json({ success: true, data: newVideo });
};

exports.changeSpeed = async (req, res) => {
    const { videoId, speed } = req.body;
    if (!speed || speed <= 0) throw new Error('Invalid speed');

    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);
    
    // Video PTS (Presentation Time Stamp) must be inverted. 2x speed = 0.5x PTS
    const videoPts = 1 / speed;
    
    await processVideo(inputPath, outputPath, (cmd) => 
        cmd.videoFilters(`setpts=${videoPts}*PTS`).audioFilters(`atempo=${speed}`)
    );

    const newVideo = await saveVideoToDB(req, video, outputPath, `Speed ${speed}x`);
    res.status(200).json({ success: true, data: newVideo });
};

exports.adjustVolume = async (req, res) => {
    const { videoId, volume } = req.body; 
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);

    await processVideo(inputPath, outputPath, (cmd) => cmd.audioFilters(`volume=${volume}`));

    const newVideo = await saveVideoToDB(req, video, outputPath, `Volume ${volume}`);
    res.status(200).json({ success: true, data: newVideo });
};

exports.mirrorVideo = async (req, res) => {
    const { videoId, direction } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);
    const filter = direction === 'v' ? 'vflip' : 'hflip';

    await processVideo(inputPath, outputPath, (cmd) => cmd.videoFilters(filter));
    const newVideo = await saveVideoToDB(req, video, outputPath, `Mirror ${direction}`);
    res.status(200).json({ success: true, data: newVideo });
};

exports.reverseVideo = async (req, res) => {
    const { videoId } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);

    // Reverse both Audio and Video
    await processVideo(inputPath, outputPath, (cmd) => 
        cmd.videoFilters('reverse').audioFilters('areverse')
    );

    const newVideo = await saveVideoToDB(req, video, outputPath, 'Reversed');
    res.status(200).json({ success: true, data: newVideo });
};

exports.mergeVideos = async (req, res) => {
    const { videoId1, videoId2 } = req.body;
    const video1 = await Video.findByPk(videoId1);
    const video2 = await Video.findByPk(videoId2);
    if (!video1 || !video2) throw new Error('Videos not found');

    const inputPath1 = getAbsolutePath(video1.filePath);
    const inputPath2 = getAbsolutePath(video2.filePath);
    const outputPath = createOutputPath('mp4');
    
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(inputPath1)
            .input(inputPath2)
            .on('end', resolve)
            .on('error', (err) => {
                deleteFile(outputPath);
                reject(err);
            })
            .mergeToFile(outputPath, path.join(__dirname, '../public/temp'));
    });

    const newVideo = await saveVideoToDB(req, video1, outputPath, 'Merged');
    res.status(200).json({ success: true, data: newVideo });
};

// ==========================================
//  3. NEW FEATURES: OVERLAYS & BACKGROUNDS
// ==========================================

exports.addText = async (req, res) => {
    const { videoId, text, x, y, fontsize, fontcolor } = req.body;
    
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);
    
    // Note: Ensure you have a font file in 'assets/fonts/Arial.ttf'
    // If not, remove the `fontfile` parameter, but it might fail on some Linux servers.
    const fontPath = path.join(__dirname, '../assets/fonts/Arial.ttf'); 
    
    // Build Filter
    let filter = `drawtext=text='${text}':fontcolor=${fontcolor}:fontsize=${fontsize}:x=${x}:y=${y}`;
    if (fs.existsSync(fontPath)) {
        // Escape backslashes for FFmpeg
        const cleanFontPath = fontPath.replace(/\\/g, '/');
        filter += `:fontfile='${cleanFontPath}'`;
    }

    await processVideo(inputPath, outputPath, (cmd) => 
        cmd.videoFilters(filter)
    );

    const newVideo = await saveVideoToDB(req, video, outputPath, 'Added Text');
    res.status(200).json({ success: true, data: newVideo });
};

exports.addImage = async (req, res) => {
    const { videoId, x, y, scale } = req.body;
    if (!req.file) throw new Error('No image uploaded');

    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const imagePath = req.file.path; // Absolute path from Multer
    const outputPath = createOutputPath(video.format);

    // Complex Filter: Scale image -> Overlay on Video
    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .input(imagePath)
            .complexFilter([
                `[1:v]scale=iw*${scale}:-1[img]`, // Scale image
                `[0:v][img]overlay=x=${x}:y=${y}` // Overlay
            ])
            .save(outputPath)
            .on('end', () => {
                deleteFile(imagePath); // Clean up temp image
                resolve();
            })
            .on('error', (err) => {
                deleteFile(outputPath);
                reject(err);
            });
    });

    const newVideo = await saveVideoToDB(req, video, outputPath, 'Added Image');
    res.status(200).json({ success: true, data: newVideo });
};

exports.removeBackground = async (req, res) => {
    const { videoId, color, similarity, blend } = req.body; // e.g. 0x00FF00
    
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    // Must output MOV or WEBM to support transparency (Alpha Channel)
    const outputPath = createOutputPath('mov'); 

    // FFmpeg colorkey filter
    const filter = `colorkey=${color}:${similarity}:${blend}`;

    await processVideo(inputPath, outputPath, (cmd) => 
        cmd.videoFilters(filter)
           .outputOptions('-c:v qtrle') // Apple Animation Codec (supports alpha)
    );

    const newVideo = await saveVideoToDB(req, video, outputPath, 'Bg Removed', 'mov');
    res.status(200).json({ success: true, data: newVideo });
};

exports.changeBackground = async (req, res) => {
    const { videoId } = req.body;
    if (!req.file) throw new Error('No background image uploaded');

    const video = await Video.findByPk(videoId); // Foreground (Video)
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const bgPath = req.file.path; // Background (Image)
    const outputPath = createOutputPath('mp4');

    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(bgPath)        // Input 0: Background Image
            .input(inputPath)     // Input 1: Foreground Video
            .complexFilter([
                // Scale Bg to match Video (1920x1080 default)
                `[0:v]scale=1920:1080[bg]`, 
                // Overlay video on top of background
                `[bg][1:v]overlay=(W-w)/2:(H-h)/2:format=auto`
            ])
            // Loop image to match video duration
            .inputOptions(['-stream_loop -1']) 
            .outputOptions(['-shortest', '-map 0:v', '-map 1:a?']) // Stop when video ends
            .save(outputPath)
            .on('end', () => {
                deleteFile(bgPath);
                resolve();
            })
            .on('error', (err) => {
                deleteFile(outputPath);
                reject(err);
            });
    });

    const newVideo = await saveVideoToDB(req, video, outputPath, 'New Background');
    res.status(200).json({ success: true, data: newVideo });
};

// ==========================================
//  4. LEGACY / ADDITIONAL FEATURES
// ==========================================

exports.applyFilter = async (req, res) => {
    const { videoId, filterType } = req.body;
    
    // "None" filter acts as Undo
    if (filterType === 'none') return exports.removeLastEdit(req, res);

    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);
    
    const filters = {
        'invert': 'negate',
        'sepia': 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
        'contrast': 'eq=contrast=1.5',
        'brightness': 'eq=brightness=0.06',
        'grayscale': 'hue=s=0'
    };
    const selectedFilter = filters[filterType] || 'hue=s=0';

    await processVideo(inputPath, outputPath, (cmd) => cmd.videoFilters(selectedFilter));
    const newVideo = await saveVideoToDB(req, video, outputPath, `Filter ${filterType}`);
    res.status(200).json({ success: true, data: newVideo });
};

exports.addWatermark = async (req, res) => {
    const { videoId, text } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);
    const filter = `drawtext=text='${text}':fontcolor=white:fontsize=24:x=10:y=10:box=1:boxcolor=black@0.5`;

    await processVideo(inputPath, outputPath, (cmd) => cmd.videoFilters(filter));
    const newVideo = await saveVideoToDB(req, video, outputPath, 'Watermarked');
    res.status(200).json({ success: true, data: newVideo });
};

exports.convertToGif = async (req, res) => {
    const { videoId, startTime = '00:00:00', duration = 5 } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath('gif');

    await processVideo(inputPath, outputPath, (cmd) => 
        cmd.setStartTime(startTime)
           .setDuration(duration)
           .outputOptions('-vf', 'fps=10,scale=320:-1:flags=lanczos')
    );

    const newVideo = await saveVideoToDB(req, video, outputPath, 'GIF', 'gif');
    res.status(200).json({ success: true, data: newVideo });
};

exports.muteVideo = async (req, res) => {
    const { videoId } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);

    await processVideo(inputPath, outputPath, (cmd) => cmd.noAudio());
    
    const newVideo = await saveVideoToDB(req, video, outputPath, 'Muted');
    res.status(200).json({ success: true, data: newVideo });
};

exports.extractAudio = async (req, res) => {
    const { videoId } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath('mp3');

    await processVideo(inputPath, outputPath, (cmd) => cmd.noVideo().audioCodec('libmp3lame'));

    const newVideo = await saveVideoToDB(req, video, outputPath, 'Audio Extracted', 'mp3');
    res.status(200).json({ success: true, data: newVideo });
};

exports.rotateVideo = async (req, res) => {
    const { videoId } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);
    // transpose=1 means 90 degrees clockwise
    await processVideo(inputPath, outputPath, (cmd) => cmd.videoFilters('transpose=1'));

    const newVideo = await saveVideoToDB(req, video, outputPath, 'Rotated');
    res.status(200).json({ success: true, data: newVideo });
};

exports.transcodeVideo = async (req, res) => {
    const { videoId, format } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const targetFormat = format || 'mp4';
    const outputPath = createOutputPath(targetFormat);

    await processVideo(inputPath, outputPath, (cmd) => cmd.toFormat(targetFormat));

    const newVideo = await saveVideoToDB(req, video, outputPath, `Transcoded to ${targetFormat}`, targetFormat);
    res.status(200).json({ success: true, data: newVideo });
};

exports.applyFade = async (req, res) => {
    const { videoId, type, duration = 2 } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }

    const inputPath = getAbsolutePath(video.filePath);
    const outputPath = createOutputPath(video.format);
    
    let vFilter = '', aFilter = '';
    if (type === 'in' || type === 'both') {
        vFilter += `fade=t=in:st=0:d=${duration}`;
        aFilter += `afade=t=in:st=0:d=${duration}`;
    }
    
    await processVideo(inputPath, outputPath, (cmd) => 
        cmd.videoFilters(vFilter).audioFilters(aFilter)
    );

    const newVideo = await saveVideoToDB(req, video, outputPath, `Fade ${type}`);
    res.status(200).json({ success: true, data: newVideo });
};

exports.mixAudio = async (req, res) => {
    const { videoId } = req.body;
    const video = await Video.findByPk(videoId);
    if (!video) { res.status(404); throw new Error('Video not found'); }
    if (!req.file) { res.status(400); throw new Error('No audio file uploaded'); }

    const inputPath = getAbsolutePath(video.filePath);
    const audioPath = req.file.path;
    const outputPath = createOutputPath(video.format);

    // Custom complex filter for mixing
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(inputPath)
            .input(audioPath)
            .complexFilter(['[0:a][1:a]amix=inputs=2:duration=shortest[a]'])
            .outputOptions(['-map 0:v', '-map [a]', '-c:v copy', '-shortest'])
            .save(outputPath)
            .on('end', () => {
                deleteFile(audioPath); // Clean temp audio
                resolve();
            })
            .on('error', (err) => {
                deleteFile(outputPath);
                reject(err);
            });
    });

    const newVideo = await saveVideoToDB(req, video, outputPath, 'Audio Mixed');
    res.status(200).json({ success: true, data: newVideo });
};

exports.replaceVideoContent = async (req, res) => {
    const { id } = req.params;
    if (!req.file) { res.status(400); throw new Error("No file uploaded"); }

    const video = await Video.findByPk(id);
    if (!video) { res.status(404); throw new Error("Video not found"); }

    // Delete old file from disk
    const oldPath = getAbsolutePath(video.filePath);
    deleteFile(oldPath);

    // Calculate new relative path for DB
    const relativePath = path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/');

    // Update DB with new file info
    await video.update({
        filename: req.file.filename,
        filePath: relativePath,
        originalName: req.file.originalname,
        size: req.file.size,
        title: `Replaced: ${req.file.originalname}`
    });

    res.status(200).json({ success: true, message: "Replaced", data: video });
};