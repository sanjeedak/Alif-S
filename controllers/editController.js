const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');

// 1. TRIM VIDEO (FAST MODE + Undo Support)
exports.trimVideo = async (req, res) => {
    try {
        const { videoId, startTime, duration } = req.body; 

        const video = await Video.findByPk(videoId);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        const inputPath = video.filePath;
        const outputFilename = `trimmed-${Date.now()}-${video.filename}`;
        const outputPath = path.join('uploads', outputFilename);

        console.log(`🎬 Trimming video (Ultrafast): ${inputPath}`);

        ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(duration)
            .outputOptions('-preset ultrafast') // 🚀 Speed Booster
            .output(outputPath)
            .on('end', async () => {
                console.log('✅ Video Trimmed Successfully');
                const newVideo = await Video.create({
                    userId: req.user.id,
                    parentId: video.id, // Parent tracked for Undo
                    title: `Trimmed: ${video.title}`,
                    filename: outputFilename,
                    filePath: outputPath,
                    size: fs.statSync(outputPath).size,
                    format: video.format
                });
                res.status(200).json({ message: 'Video trimmed successfully', newVideo });
            })
            .on('error', (err) => {
                console.error('Error trimming video:', err);
                res.status(500).json({ message: 'Error processing video', error: err.message });
            })
            .run();
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 2. CHANGE SPEED (FAST MODE + Undo Support)
exports.changeSpeed = async (req, res) => {
    try {
        const { videoId, speed } = req.body; 

        const video = await Video.findByPk(videoId);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        const inputPath = video.filePath;
        const outputFilename = `speed-${speed}x-${Date.now()}-${video.filename}`;
        const outputPath = path.join('uploads', outputFilename);

        console.log(`⚡ Changing speed to ${speed}x (Ultrafast)`);

        let videoFilter = `setpts=${1/speed}*PTS`;
        let audioFilter = `atempo=${speed}`;

        ffmpeg(inputPath)
            .videoFilters(videoFilter)
            .audioFilters(audioFilter)
            .outputOptions('-preset ultrafast') // 🚀 Speed Booster
            .output(outputPath)
            .on('end', async () => {
                console.log('✅ Speed Changed Successfully');
                const newVideo = await Video.create({
                    userId: req.user.id,
                    parentId: video.id, // Parent tracked for Undo
                    title: `Speed ${speed}x: ${video.title}`,
                    filename: outputFilename,
                    filePath: outputPath,
                    size: fs.statSync(outputPath).size,
                    format: video.format
                });
                res.status(200).json({ message: `Video speed changed to ${speed}x`, newVideo });
            })
            .on('error', (err) => {
                console.error('Error changing speed:', err);
                res.status(500).json({ message: 'Error processing video', error: err.message });
            })
            .run();
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 3. APPLY FILTER (FAST MODE + Undo Support)
exports.applyFilter = async (req, res) => {
    try {
        const { videoId, filterType } = req.body; 

        const video = await Video.findByPk(videoId);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        const inputPath = video.filePath;
        const outputFilename = `filter-${filterType}-${Date.now()}-${video.filename}`;
        const outputPath = path.join('uploads', outputFilename);

        console.log(`🎨 Applying filter: ${filterType} (Ultrafast)`);

        let videoFilter = '';
        if (filterType === 'grayscale') {
            videoFilter = 'hue=s=0';
        } else if (filterType === 'invert') {
            videoFilter = 'negate';
        } else if (filterType === 'sepia') {
            videoFilter = 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
        } else {
            return res.status(400).json({ message: 'Invalid filter type' });
        }

        ffmpeg(inputPath)
            .videoFilters(videoFilter)
            .outputOptions('-preset ultrafast') // 🚀 Speed Booster
            .output(outputPath)
            .on('end', async () => {
                console.log('✅ Filter Applied Successfully');
                const newVideo = await Video.create({
                    userId: req.user.id,
                    parentId: video.id, // Parent tracked for Undo
                    title: `Filter (${filterType}): ${video.title}`,
                    filename: outputFilename,
                    filePath: outputPath,
                    size: fs.statSync(outputPath).size,
                    format: video.format
                });
                res.status(200).json({ message: `Filter ${filterType} applied successfully`, newVideo });
            })
            .on('error', (err) => {
                console.error('Error applying filter:', err);
                res.status(500).json({ message: 'Error processing video', error: err.message });
            })
            .run();
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 4. MERGE VIDEOS (FAST MODE + Undo Support)
exports.mergeVideos = async (req, res) => {
    try {
        const { videoId1, videoId2 } = req.body; 

        const video1 = await Video.findByPk(videoId1);
        const video2 = await Video.findByPk(videoId2);

        if (!video1 || !video2) {
            return res.status(404).json({ message: 'One or both videos not found' });
        }

        const outputFilename = `merged-${Date.now()}.mp4`;
        const outputPath = path.join('uploads', outputFilename);

        console.log(`🔗 Merging (Ultrafast): ${video1.filename} + ${video2.filename}`);

        ffmpeg()
            .input(video1.filePath)
            .input(video2.filePath)
            .outputOptions('-preset ultrafast') // 🚀 Speed Booster
            .on('end', async () => {
                console.log('✅ Videos Merged Successfully');
                const newVideo = await Video.create({
                    userId: req.user.id,
                    // FIX: Changed 'video.id' to 'video1.id' because 'video' is not defined here
                    parentId: video1.id, 
                    title: `Merged: ${video1.title} + ${video2.title}`,
                    filename: outputFilename,
                    filePath: outputPath,
                    size: fs.statSync(outputPath).size,
                    format: 'mp4'
                });
                res.status(200).json({ message: 'Videos merged successfully', newVideo });
            })
            .on('error', (err) => {
                console.error('Error merging videos:', err);
                res.status(500).json({ message: 'Merge failed', error: err.message });
            })
            .mergeToFile(outputPath, './temp/'); 
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};