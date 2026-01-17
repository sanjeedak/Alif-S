const ffmpeg = require('fluent-ffmpeg');
const { createOutputPath, deleteFile } = require('./fileHelper');
const Video = require('../models/Video');
const path = require('path');
const fs = require('fs');

/**
 * 🔥 FIXED RENDERER
 * Handles both Raw IDs and Clip Objects
 */
const renderTimeline = async (clips, settings) => {
    const { width = 1920, height = 1080 } = settings || {};
    
    // 1. Fetch File Paths from DB with Type Checking
    const videos = await Promise.all(
        clips.map(async (clip) => {
            // Check if clip is an object (from projectController) or just an ID string
            const id = (typeof clip === 'object' && clip !== null) ? clip.videoId : clip;
            
            if (!id) throw new Error('Invalid Clip Data: videoId is missing');

            const video = await Video.findByPk(id);
            if (!video) return null;

            // Resolve absolute path for FFmpeg
            const absolutePath = path.join(__dirname, '../', video.filePath);
            
            if (!fs.existsSync(absolutePath)) {
                console.error(`Missing file: ${absolutePath}`);
                return null;
            }

            return {
                ...video.toJSON(),
                absolutePath
            };
        })
    );

    // Filter out missing assets to prevent crash
    const validVideos = videos.filter(v => v !== null);

    if (validVideos.length === 0 || validVideos.length !== clips.length) {
        throw new Error('One or more video assets are missing or deleted from disk.');
    }

    const outputPath = createOutputPath('mp4');
    
    return new Promise((resolve, reject) => {
        let command = ffmpeg();

        // 2. Add Inputs
        validVideos.forEach(video => {
            command.input(video.absolutePath);
        });

        // 3. Build Complex Filter (Scale & Concat)
        let filterComplex = [];
        let inputs = '';

        validVideos.forEach((_, index) => {
            // Scale logic: Fit to project resolution with padding for different aspect ratios
            filterComplex.push(
                `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${index}]`
            );
            // Concatenation input map (Video + Audio)
            inputs += `[v${index}][${index}:a]`;
        });

        // Concat all streams into one
        filterComplex.push(`${inputs}concat=n=${validVideos.length}:v=1:a=1[outv][outa]`);

        command
            .complexFilter(filterComplex)
            .outputOptions([
                '-map [outv]', 
                '-map [outa]', 
                '-preset ultrafast', 
                '-crf 23',
                '-c:v libx264',
                '-c:a aac'
            ])
            .on('end', () => {
                console.log('✅ Render Completed:', outputPath);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('❌ Render Error:', err.message);
                if (fs.existsSync(outputPath)) deleteFile(outputPath);
                reject(new Error('Rendering Failed: ' + err.message));
            })
            .save(outputPath);
    });
};

module.exports = { renderTimeline };