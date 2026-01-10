const Video = require('../models/Video');
const { deleteFile } = require('../utils/fileHelper');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// ==========================================
//  HELPER FUNCTIONS
// ==========================================

/**
 * Normalizes a system path to a relative web-friendly path.
 * Example: "C:\Users\Project\uploads\video.mp4" -> "uploads/video.mp4"
 */
const normalizePath = (sysPath) => {
    // 1. Make path relative to the project root (assuming this file is in /controllers)
    const relative = path.relative(path.join(__dirname, '..'), sysPath);
    // 2. Replace backslashes (Windows) with forward slashes (Web Standard)
    return relative.replace(/\\/g, '/');
};

/**
 * Resolves a relative DB path to an absolute system path.
 * Required for FS operations (delete, download) and FFmpeg.
 */
const getAbsolutePath = (relativePath) => {
    return path.join(__dirname, '../', relativePath);
};

// ==========================================
//  CONTROLLERS
// ==========================================

// 1. UPLOAD VIDEO
exports.uploadVideo = async (req, res) => {
    if (!req.file) throw new Error('No video uploaded');

    // 1. Get Absolute Paths for Processing
    const videoPath = req.file.path; 
    const thumbnailFilename = `thumb-${path.parse(req.file.filename).name}.png`;
    
    // Thumbnail destination (Absolute path for FFmpeg)
    const thumbsDir = path.join(__dirname, '../uploads/thumbnails');
    const absoluteThumbPath = path.join(thumbsDir, thumbnailFilename);

    console.log("📸 Generating Thumbnail...");

    // 2. Generate Thumbnail
    try {
        // Ensure folder exists
        if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: ['00:00:01'], // Take screenshot at 1s mark
                    filename: thumbnailFilename,
                    folder: thumbsDir,
                    size: '320x240'
                })
                .on('end', resolve)
                .on('error', (err) => {
                    console.error("FFmpeg Thumbnail Error:", err);
                    reject(err);
                });
        });
    } catch (err) {
        console.error("Thumbnail generation failed (skipping):", err.message);
        // We continue even if thumbnail fails, just save without it
    }

    // 3. Prepare Relative Paths for Database
    const relativeVideoPath = normalizePath(videoPath);
    const relativeThumbPath = fs.existsSync(absoluteThumbPath) 
        ? normalizePath(absoluteThumbPath) 
        : null;

    // 4. Save to DB
    const newVideo = await Video.create({
        userId: req.user.id,
        title: req.file.originalname,
        filename: req.file.filename,
        filePath: relativeVideoPath, // ✅ Saved as "uploads/..."
        thumbnail: relativeThumbPath, // ✅ Saved as "uploads/thumbnails/..."
        size: req.file.size,
        format: path.extname(req.file.originalname).substring(1)
    });

    res.status(201).json({ 
        success: true, 
        message: 'Video uploaded successfully', 
        video: newVideo 
    });
};

// 2. GET USER VIDEOS
exports.getUserVideos = async (req, res) => {
    // Return videos sorted by newest first
    const videos = await Video.findAll({ 
        where: { userId: req.user.id }, 
        order: [['createdAt', 'DESC']] 
    });
    res.status(200).json({ success: true, data: videos });
};

// 3. DOWNLOAD VIDEO
exports.downloadVideo = async (req, res) => {
    const video = await Video.findByPk(req.params.id);
    if (!video) {
        res.status(404);
        throw new Error('Video not found');
    }

    // Convert stored relative path back to absolute path for Express
    const absolutePath = getAbsolutePath(video.filePath);

    if (!fs.existsSync(absolutePath)) {
        res.status(404);
        throw new Error('File not found on server disk');
    }

    res.download(absolutePath, video.title, (err) => {
        if (err && err.code !== 'EPIPE') {
            console.error('Download error:', err);
        }
    });
};

// 4. DELETE VIDEO
exports.deleteVideo = async (req, res) => {
    const video = await Video.findByPk(req.params.id);
    if (!video) {
        res.status(404);
        throw new Error('Video not found');
    }
    
    // Security check: Ensure user owns the video
    if (video.userId !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized to delete this video');
    }

    // 1. Delete actual files from disk
    const videoAbsPath = getAbsolutePath(video.filePath);
    deleteFile(videoAbsPath);

    if (video.thumbnail) {
        const thumbAbsPath = getAbsolutePath(video.thumbnail);
        deleteFile(thumbAbsPath);
    }

    // 2. Remove record from Database
    await video.destroy();

    res.status(200).json({ success: true, message: 'Video deleted successfully' });
};