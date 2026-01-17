const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Storage Engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'uploads/originals/'; // Default video folder (matching your previous setup)

        if (file.mimetype.startsWith('image')) {
            folder = 'uploads/images/';
        } else if (file.mimetype.startsWith('audio')) {
            folder = 'uploads/audio/';
        }
        
        // 🔥 FIX: Hamesha Project Root se path resolve karein
        const rootPath = process.cwd();
        const fullPath = path.join(rootPath, folder);
        
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        
        // Multer ko relative path chahiye hota hai
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        // Safe filename format: alifs-1672531200-928374.mp4
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'alifs-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});

// 2. File Filter
const fileFilter = (req, file, cb) => {
    // Regex for broad matching
    const videoMime = /video\/(mp4|quicktime|x-msvideo|x-matroska|webm|x-flv|mpeg)/;
    const imageMime = /image\/(jpeg|jpg|png|gif|webp|svg\+xml)/;
    const audioMime = /audio\/(mpeg|wav|x-wav|aac|ogg|mp4|x-m4a)/; 

    const isVideo = videoMime.test(file.mimetype) || file.mimetype === 'application/octet-stream';
    const isImage = imageMime.test(file.mimetype);
    const isAudio = audioMime.test(file.mimetype);

    if (isVideo || isImage || isAudio) {
        cb(null, true);
    } else {
        console.error(`❌ Rejected File: ${file.originalname} | Mime: ${file.mimetype}`);
        cb(new Error('Unsupported file format! Only Videos, Images, and Audio allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { 
        fileSize: 500 * 1024 * 1024 // 500MB Limit
    } 
});

module.exports = upload;