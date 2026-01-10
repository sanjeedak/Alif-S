const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// SFX Folder ka path
const sfxDir = path.join(__dirname, '../assets/sfx');

// Helper Function: Promise use karke Duration nikalna
const getAudioMetadata = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve({
                duration: metadata.format.duration, // Seconds mein time
                size: metadata.format.size,        // Bytes mein size
                format: metadata.format.format_name
            });
        });
    });
};

exports.getAudioAssets = async (req, res) => {
    try {
        // 1. Folder check karo
        if (!fs.existsSync(sfxDir)) {
            return res.status(404).json({ message: "SFX Directory not found" });
        }

        // 2. Sirf Audio files filter karo
        const files = fs.readdirSync(sfxDir).filter(file => file.endsWith('.mp3') || file.endsWith('.wav'));

        // 3. Har file ka Metadata nikalo (Heavy operation, isliye async use karenge)
        const assetsData = await Promise.all(files.map(async (file) => {
            const filePath = path.join(sfxDir, file);
            
            try {
                const meta = await getAudioMetadata(filePath);
                
                return {
                    id: file.replace('.', '_'), // Unique ID for frontend
                    name: file,
                    url: `/sounds/${file}`,     // Playable URL
                    duration: meta.duration,    // e.g., 2.5 seconds (Important for Timeline)
                    size: (meta.size / 1024).toFixed(2) + ' KB'
                };
            } catch (err) {
                console.error(`Error reading metadata for ${file}:`, err);
                return null;
            }
        }));

        // Null values filter kar do (agar kisi file me error aaya ho)
        const validAssets = assetsData.filter(asset => asset !== null);

        res.json({
            success: true,
            total: validAssets.length,
            data: validAssets
        });

    } catch (error) {
        console.error("Asset Controller Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
};