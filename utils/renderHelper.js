const ffmpeg = require('fluent-ffmpeg');
const { createOutputPath, deleteFile } = require('./fileHelper');
const Video = require('../models/Video');

const renderTimeline = async (clipIds, settings) => {
    const { width = 1920, height = 1080 } = settings;
    
    // 1. Fetch File Paths from DB
    const videos = await Promise.all(
        clipIds.map(id => Video.findByPk(id))
    );

    if (videos.some(v => !v)) throw new Error('One or more video assets are missing.');

    const outputPath = createOutputPath('mp4');
    
    return new Promise((resolve, reject) => {
        let command = ffmpeg();

        // 2. Add Inputs
        videos.forEach(video => {
            command.input(video.filePath);
        });

        // 3. Build Complex Filter (Scale & Concat)
        let filterComplex = [];
        let inputs = '';

        videos.forEach((_, index) => {
            // Scale logic: Fit to project resolution
            filterComplex.push(
                `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${index}]`
            );
            // Concatenation input map
            inputs += `[v${index}][${index}:a]`;
        });

        filterComplex.push(`${inputs}concat=n=${videos.length}:v=1:a=1[outv][outa]`);

        command
            .complexFilter(filterComplex)
            .outputOptions([
                '-map [outv]', 
                '-map [outa]', 
                '-preset ultrafast', 
                '-crf 23'
            ])
            .on('end', () => resolve(outputPath))
            .on('error', (err) => {
                console.error('Render Error:', err);
                deleteFile(outputPath);
                reject(new Error('Rendering Failed: ' + err.message));
            })
            .save(outputPath);
    });
};

module.exports = { renderTimeline };