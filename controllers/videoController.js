// controllers/videoController.js
const Video = require('../models/Video');
const path = require('path');
const fs = require('fs');

exports.uploadVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No video uploaded' });
        }

        // Create Database Entry
        const video = await Video.create({
            userId: req.user.id, // Comes from Auth Middleware (we will add this next)
            title: req.body.title || req.file.originalname,
            filename: req.file.filename,
            filePath: req.file.path,
            size: req.file.size,
            format: path.extname(req.file.originalname).substring(1) // remove dot
        });

        res.status(201).json({
            message: 'Video uploaded successfully',
            video
        });

    } catch (error) {
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
};
// 2. GET USER VIDEOS
exports.getUserVideos = async (req, res) => {
    try {
        const videos = await Video.findAll({ 
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']] 
        });

        res.status(200).json({
            count: videos.length,
            videos: videos
        });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching videos', error: error.message });
    }
};
// 3. DOWNLOAD VIDEO (Export)
exports.downloadVideo = async (req, res) => {
    try {
        const video = await Video.findByPk(req.params.id);

        if (!video) {
            return res.status(404).json({ message: 'Video not found' });
        }

        // फाइल को डाउनलोड के लिए भेजें
        res.download(video.filePath, video.title, (err) => {
            if (err) {
                console.error('Download error:', err);
                // अगर फाइल नहीं मिली, तो एरर न भेजें क्योंकि headers पहले ही जा चुके होंगे
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 4. DELETE VIDEO (Remove Filter / Undo)
exports.deleteVideo = async (req, res) => {
    try {
        const video = await Video.findByPk(req.params.id);

        if (!video) {
            return res.status(404).json({ message: 'Video not found' });
        }

        // सुरक्षा: चेक करें कि क्या यह वीडियो इसी यूजर का है?
        if (video.userId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this video' });
        }

        // 1. हार्ड डिस्क (Uploads folder) से फाइल डिलीट करें
        if (fs.existsSync(video.filePath)) {
            fs.unlinkSync(video.filePath);
        }

        // 2. डेटाबेस से एंट्री डिलीट करें
        await video.destroy();

        res.status(200).json({ message: 'Video deleted successfully' });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};