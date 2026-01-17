const Video = require('../models/Video');
const { deleteFile } = require('../utils/fileHelper');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// ==========================================
//  HELPER FUNCTIONS (FIXED)
// ==========================================

/**
 * Project root se hamesha absolute path resolve karne ke liye.
 * FFmpeg aur FS operations ke liye zaroori hai.
 */
const getAbsolutePath = (relativePath) => {
    if (!relativePath) return null;
    return path.resolve(process.cwd(), relativePath);
};

/**
 * DB mein web-friendly path save karne ke liye.
 * Windows backslashes ko forward slashes mein badalta hai.
 */
const normalizePath = (sysPath) => {
    const relative = path.relative(process.cwd(), sysPath);
    return relative.replace(/\\/g, '/');
};

// ==========================================
//  CONTROLLERS
// ==========================================

// 1. UPLOAD MEDIA (Video, Audio, & Image Support)
exports.uploadVideo = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        const fileType = req.file.mimetype.split('/')[0]; // video, audio, or image
        const fileAbsPath = path.resolve(req.file.path); 
        
        const thumbnailFilename = `thumb-${path.parse(req.file.filename).name}.png`;
        const thumbsDir = path.join(process.cwd(), 'uploads/thumbnails');
        const absoluteThumbPath = path.join(thumbsDir, thumbnailFilename);

        let dbThumbPath = null;

        // --- 1. Smart Thumbnail Logic ---
        if (fileType === 'video') {
            if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

            // Ensure DB entry happens AFTER thumbnail is ready
            await new Promise((resolve, reject) => {
                ffmpeg(fileAbsPath)
                    .screenshots({
                        timestamps: ['00:00:01'],
                        filename: thumbnailFilename,
                        folder: thumbsDir,
                        size: '320x240'
                    })
                    .on('end', () => {
                        console.log("✅ Thumbnail Generated:", thumbnailFilename);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error("❌ FFmpeg Error:", err.message);
                        reject(err);
                    });
            });
            dbThumbPath = `uploads/thumbnails/${thumbnailFilename}`;
        } 
        else if (fileType === 'image') {
            // 🔥 Image ke liye wahi file thumbnail ban jayegi
            dbThumbPath = normalizePath(req.file.path);
        }
        // Audio ke liye thumbnail null rahega, frontend icon dikhayega

        // --- 2. Database Entry ---
        const newVideo = await Video.create({
            userId: req.user.id,
            title: req.file.originalname,
            filename: req.file.filename,
            filePath: normalizePath(req.file.path), 
            thumbnail: dbThumbPath,
            size: req.file.size,
            format: path.extname(req.file.originalname).substring(1).toLowerCase(),
            type: fileType // video, audio, ya image save hoga
        });

        res.status(201).json({ success: true, video: newVideo });
    } catch (err) {
        console.error("🔥 Upload Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// 2. GET USER MEDIA
exports.getUserVideos = async (req, res) => {
    try {
        const videos = await Video.findAll({ 
            where: { userId: req.user.id }, 
            order: [['createdAt', 'DESC']] 
        });
        res.status(200).json({ success: true, data: videos });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 3. DELETE MEDIA (Permanent Fix)
exports.deleteVideo = async (req, res) => {
    try {
        const video = await Video.findByPk(req.params.id);
        if (!video) return res.status(404).json({ success: false, message: 'Media not found' });
        
        if (video.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Physical File Deletion
        const videoAbsPath = getAbsolutePath(video.filePath); 
        if (fs.existsSync(videoAbsPath)) fs.unlinkSync(videoAbsPath);

        // Thumbnail Deletion (Sirf agar video type tha)
        if (video.thumbnail && video.type === 'video') {
            const thumbAbsPath = getAbsolutePath(video.thumbnail);
            if (fs.existsSync(thumbAbsPath)) fs.unlinkSync(thumbAbsPath);
        }

        await video.destroy();
        res.status(200).json({ success: true, message: 'Media deleted successfully' });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 4. DOWNLOAD MEDIA
exports.downloadVideo = async (req, res) => {
    try {
        const video = await Video.findByPk(req.params.id);
        if (!video) return res.status(404).json({ message: 'File not found' });

        const absolutePath = getAbsolutePath(video.filePath);
        if (!fs.existsSync(absolutePath)) return res.status(404).json({ message: 'File missing on disk' });

        // Force download with original filename
        res.download(absolutePath, video.title);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};