const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { 
    validateRequest, trimSchema, cropSchema, speedSchema, 
    volumeSchema, mirrorSchema, mergeSchema, filterSchema, 
    watermarkSchema, gifSchema, fadeSchema, transcodeSchema, 
    simpleVideoIdSchema,addTextSchema, 
    addImageSchema, 
    removeBgSchema,
    changeBgSchema
} = require('../middleware/validators');

const { uploadVideo, getUserVideos, downloadVideo, deleteVideo } = require('../controllers/videoController');
const editController = require('../controllers/editController');

// --- CRUD ---
router.post('/upload', protect, upload.single('video'), uploadVideo);
router.get('/myvideos', protect, getUserVideos);
router.get('/download/:id', downloadVideo); 
router.delete('/:id', protect, deleteVideo);

// --- Undo ---
router.post('/undo/:id', protect, editController.removeLastEdit);

// --- Editing (Validated) ---
router.post('/edit/trim',   protect, validateRequest(trimSchema),   editController.trimVideo);
router.post('/edit/crop',   protect, validateRequest(cropSchema),   editController.cropVideo);
router.post('/edit/speed',  protect, validateRequest(speedSchema),  editController.changeSpeed);
router.post('/edit/volume', protect, validateRequest(volumeSchema), editController.adjustVolume);
router.post('/edit/mirror', protect, validateRequest(mirrorSchema), editController.mirrorVideo);
router.post('/edit/reverse',protect, validateRequest(simpleVideoIdSchema), editController.reverseVideo);
router.post('/edit/merge',  protect, validateRequest(mergeSchema),  editController.mergeVideos);

// --- Additional ---
router.post('/edit/filter',    protect, validateRequest(filterSchema),      editController.applyFilter);
router.post('/edit/watermark', protect, validateRequest(watermarkSchema),   editController.addWatermark);
router.post('/edit/gif',       protect, validateRequest(gifSchema),         editController.convertToGif);
router.post('/edit/mute',      protect, validateRequest(simpleVideoIdSchema), editController.muteVideo);
router.post('/edit/audio',     protect, validateRequest(simpleVideoIdSchema), editController.extractAudio);
router.post('/edit/rotate',    protect, validateRequest(simpleVideoIdSchema), editController.rotateVideo);
router.post('/edit/transcode', protect, validateRequest(transcodeSchema),   editController.transcodeVideo);
router.post('/edit/fade',      protect, validateRequest(fadeSchema),        editController.applyFade);

router.post('/edit/mix-audio', protect, upload.single('audio'), editController.mixAudio);
router.put('/replace/:id',     protect, upload.single('video'), editController.replaceVideoContent);
// --- NEW FEATURES ---

// 1. Add Text
router.post('/edit/text', protect, validateRequest(addTextSchema), editController.addText);

// 2. Add Image (Overlay)
router.post('/edit/image', protect, upload.single('image'), validateRequest(addImageSchema), editController.addImage);

// 3. Remove Background (Green Screen)
router.post('/edit/remove-bg', protect, validateRequest(removeBgSchema), editController.removeBackground);

// 4. Change Background (Video over Image)
router.post('/edit/change-bg', protect, upload.single('image'), validateRequest(changeBgSchema), editController.changeBackground);

module.exports = router;