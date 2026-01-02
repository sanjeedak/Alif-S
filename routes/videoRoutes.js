// routes/videoRoutes.js
const express = require('express');
const router = express.Router();

const { 
    uploadVideo, 
    getUserVideos, 
    downloadVideo, 
    deleteVideo 
} = require('../controllers/videoController');

const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');

// Route: POST /api/videos/upload
router.post('/upload', protect, upload.single('video'), uploadVideo);

// Route: GET /api/videos/myvideos
router.get('/myvideos', protect, getUserVideos);
// उदाहरण: GET /api/videos/download/VIDEO_ID
router.get('/download/:id', downloadVideo);
// उदाहरण: DELETE /api/videos/VIDEO_ID
router.delete('/:id', protect, deleteVideo);

module.exports = router;