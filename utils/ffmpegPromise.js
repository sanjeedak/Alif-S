// utils/ffmpegPromise.js
const ffmpeg = require('fluent-ffmpeg');
const { deleteFile } = require('./fileHelper');

/**
 * Production Ready FFmpeg Wrapper
 * Includes Timeouts and explicit error handling
 */
const processVideo = (inputPath, outputPath, commandBuilder, timeoutSeconds = 300) => {
    return new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath);
        
        // Apply logic
        command = commandBuilder(command);

        // Set Timeout (Default 5 minutes)
        const timeout = setTimeout(() => {
            command.kill('SIGKILL');
            deleteFile(outputPath);
            reject(new Error('Processing Timed Out (Limit: 5 mins)'));
        }, timeoutSeconds * 1000);

        command
            .outputOptions('-preset ultrafast') 
            .on('end', () => {
                clearTimeout(timeout);
                resolve(outputPath);
            })
            .on('error', (err) => {
                clearTimeout(timeout);
                console.error('❌ FFmpeg Error:', err.message);
                deleteFile(outputPath); // Ensure cleanup on fail
                reject(new Error(`Video processing failed: ${err.message}`));
            })
            .save(outputPath);
    });
};

module.exports = processVideo;