const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Validators
const { 
    validateRequest, trimSchema, cropSchema, speedSchema, 
    volumeSchema, mirrorSchema, mergeSchema, filterSchema, 
    watermarkSchema, gifSchema, fadeSchema, transcodeSchema, 
    simpleVideoIdSchema, addTextSchema, addImageSchema, 
    removeBgSchema, changeBgSchema
} = require('../middleware/validators');

// Controllers
const videoController = require('../controllers/videoController');
const editController = require('../controllers/editController');

// --- CRUD ---
router.post('/upload', protect, upload.single('video'), videoController.uploadVideo);
router.get('/myvideos', protect, videoController.getUserVideos);
router.get('/download/:id', videoController.downloadVideo);
router.delete('/:id', protect, videoController.deleteVideo);

// --- Undo ---
router.post('/undo/:id', protect, editController.removeLastEdit);

// --- Canva-Style Merging (Full Project Flattening) ---
// Note: mergeSchema must handle timelineData as discussed
router.post('/edit/merge', protect, editController.mergeVideos);

// --- Basic Editing Tools ---
router.post('/edit/trim',    protect, validateRequest(trimSchema),   editController.trimVideo);
router.post('/edit/crop',    protect, validateRequest(cropSchema),   editController.cropVideo);
router.post('/edit/speed',   protect, validateRequest(speedSchema),  editController.changeSpeed);
router.post('/edit/volume',  protect, validateRequest(volumeSchema), editController.adjustVolume);
router.post('/edit/mirror',  protect, validateRequest(mirrorSchema), editController.mirrorVideo);
router.post('/edit/reverse', protect, validateRequest(simpleVideoIdSchema), editController.reverseVideo);
router.post('/edit/rotate',  protect, validateRequest(simpleVideoIdSchema), editController.rotateVideo);
router.post('/edit/filter',  protect, validateRequest(filterSchema),      editController.applyFilter);

// --- Overlays & Effects ---
router.post('/edit/text', protect, validateRequest(addTextSchema), editController.addText);

// 🔥 FIX 1: validation body check image ke liye req.file ke baad honi chahiye ya handle honi chahiye
router.post('/edit/image', protect, upload.single('image'), editController.addImage);

router.post('/edit/gif', protect, validateRequest(gifSchema), editController.convertToGif);

// --- Background Tools ---
router.post('/edit/remove-bg', protect, validateRequest(removeBgSchema), editController.removeBackground);
router.post('/edit/change-bg', protect, upload.single('image'), editController.changeBackground);

// --- Audio Utilities ---
router.post('/edit/mute',      protect, validateRequest(simpleVideoIdSchema), editController.muteVideo);
router.post('/edit/audio',     protect, validateRequest(simpleVideoIdSchema), editController.extractAudio);
router.post('/edit/mix-audio', protect, upload.single('audio'), editController.mixAudio);

// --- Utilities & Versioning ---
router.post('/edit/transcode', protect, validateRequest(transcodeSchema), editController.transcodeVideo);
router.post('/edit/fade',      protect, validateRequest(fadeSchema),      editController.applyFade);
router.put('/replace/:id',     protect, upload.single('video'),           editController.replaceVideoContent);

module.exports = router;