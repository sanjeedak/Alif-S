const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');

// Route: GET http://localhost:5001/api/assets/audio
router.get('/audio', assetController.getAudioAssets);

module.exports = router;