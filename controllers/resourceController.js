const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');

const PIXABAY_API_KEY = process.env.PIXABAY_KEY;

// REMOVED: getInbuiltSfx (Duplicate of assetController.getAudioAssets)

// 1. SEARCH ONLINE AUDIO (Pixabay)
exports.searchOnlineAudio = async (req, res) => {
    try {
        const { query } = req.query; // e.g. ?query=happy
        
        if(!PIXABAY_API_KEY || PIXABAY_API_KEY === 'YOUR_PIXABAY_API_KEY_HERE') {
            return res.status(500).json({ message: 'API Key missing. Please config Pixabay API.' });
        }

        const response = await axios.get(`https://pixabay.com/api/videos/`, {
            params: {
                key: PIXABAY_API_KEY,
                q: query,
                category: 'music'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error searching audio' });
    }
};

// 2. IMPORT AUDIO FROM URL (Download to our Server)
exports.importAudioFromUrl = async (req, res) => {
    try {
        const { audioUrl, title } = req.body;
        
        if (!audioUrl) return res.status(400).json({ message: 'Audio URL required' });

        const filename = `imported-${Date.now()}.mp3`;
        const outputPath = path.join('uploads', filename);

        console.log(`⬇️ Downloading: ${title}`);

        const writer = fs.createWriteStream(outputPath);
        const response = await axios({
            url: audioUrl,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        writer.on('finish', async () => {
            const newAudio = await Video.create({
                userId: req.user.id,
                title: title || 'Imported Audio',
                filename: filename,
                filePath: outputPath,
                size: fs.statSync(outputPath).size,
                format: 'mp3',
            });
            
            res.status(200).json({ message: 'Audio Imported Successfully', audio: newAudio });
        });

        writer.on('error', (err) => {
            console.error('Download Error:', err);
            res.status(500).json({ error: 'Failed to download audio' });
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};