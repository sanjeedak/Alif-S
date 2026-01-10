const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const { 
    searchOnlineAudio, 
    importAudioFromUrl 
} = require('../controllers/resourceController');

// Note: Use /api/assets/audio (AssetRoutes) to get local SFX list

// 1. Search Online (Pixabay/External)
router.get('/search', protect, searchOnlineAudio);

// 2. Import (Download) Audio to Project
router.post('/import', protect, importAudioFromUrl);

module.exports = router;