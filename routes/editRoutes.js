// routes/editRoutes.js
const express = require('express');
const router = express.Router();
const { trimVideo, changeSpeed,applyFilter,mergeVideos } = require('../controllers/editController');
const { protect } = require('../middleware/authMiddleware');   

// Route: POST /api/edit/trim
router.post('/trim', protect, trimVideo);
router.post('/speed', protect, changeSpeed);
router.post('/filter', protect, applyFilter);
router.post('/merge', protect, mergeVideos);
module.exports = router;