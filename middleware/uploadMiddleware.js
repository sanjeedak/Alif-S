const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Storage Engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'uploads/videos/'; // Default for videos

        // Determine folder based on file type
        if (file.mimetype.startsWith('image')) {
            folder = 'uploads/images/';
        } else if (file.mimetype.startsWith('audio')) {
            folder = 'uploads/audio/';
        }
        
        // ✅ SAFETY CHECK: Create folder if it doesn't exist
        // Note: We resolve path relative to the root of your project
        const fullPath = path.join(__dirname, '../', folder);
        
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        // Unique filename: Fieldname-Date-RandomNumber.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// 2. File Filter (Enhanced to include Audio)
const fileFilter = (req, file, cb) => {
    // --- VIDEO CHECKS ---
    const videoExt = /mp4|mov|avi|mkv|wmv|flv|webm/;
    const videoMime = /video\/(mp4|quicktime|x-msvideo|x-matroska|webm|x-flv|mpeg)/; // Added mpeg

    // --- IMAGE CHECKS ---
    const imageExt = /jpeg|jpg|png|gif|webp|svg/;
    const imageMime = /image\/(jpeg|jpg|png|gif|webp|svg\+xml)/;

    // --- AUDIO CHECKS (New) ---
    const audioExt = /mp3|wav|m4a|aac|ogg/;
    const audioMime = /audio\/(mpeg|wav|x-wav|aac|ogg|mp4|x-m4a)/; 

    const extname = path.extname(file.originalname).toLowerCase();
    
    // Validate Extension AND MimeType
    const isVideo = videoExt.test(extname) && (videoMime.test(file.mimetype) || file.mimetype === 'application/octet-stream'); // Octet-stream allows some MKVs
    const isImage = imageExt.test(extname) && imageMime.test(file.mimetype);
    const isAudio = audioExt.test(extname) && audioMime.test(file.mimetype);

    if (isVideo || isImage || isAudio) {
        cb(null, true);
    } else {
        // Log the rejected file details for debugging
        console.error(`❌ Rejected File: ${file.originalname} | Mime: ${file.mimetype}`);
        cb(new Error('Error: Unsupported file type! Only Videos, Images, and Audio allowed.'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    // ✅ FIX LIMITS: 
    // 500MB = 500 * 1024 * 1024
    limits: { fileSize: 500 * 1024 * 1024 } 
});

module.exports = upload;