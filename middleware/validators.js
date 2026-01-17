// middleware/validators.js
const Joi = require('joi');

// ✅ FIXED: Now accepts 'property' (body, params, query)
const validateRequest = (schema, property = 'body') => {
    return (req, res, next) => {
        // Validation check against req.body or req.params
        const { error } = schema.validate(req[property], { abortEarly: false });
        if (error) {
            const errors = error.details.map(detail => detail.message);
            return res.status(400).json({ success: false, message: 'Validation Error', errors });
        }
        next();
    };
};

// ==========================================
// 1. Auth Schemas
// ==========================================
const registerSchema = Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// ==========================================
// 2. Video Edit Schemas
// ==========================================
const simpleVideoIdSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required()
});

const trimSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}:\d{2}$/).required(),
    duration: Joi.number().positive().required()
});

const cropSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    w: Joi.number().positive().required(),
    h: Joi.number().positive().required(),
    x: Joi.number().min(0).required(),
    y: Joi.number().min(0).required()
});

const speedSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    speed: Joi.number().min(0.1).max(10).required()
});

const volumeSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    volume: Joi.number().min(0).max(10).required()
});

const mirrorSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    direction: Joi.string().valid('v', 'h').required()
});

// 🔥 UPDATED: Canva-style Merge Schema to handle multiple tracks
const mergeSchema = Joi.object({
    timelineData: Joi.object({
        tracks: Joi.array().items(Joi.object({
            videoId: Joi.string().guid({ version: 'uuidv4' }).required()
        })).min(1).required(),
        audioTracks: Joi.array().optional()
    }).required(),
    settings: Joi.object({
        width: Joi.number().optional(),
        height: Joi.number().optional()
    }).optional()
});

const filterSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    filterType: Joi.string().required() // Allow custom FFmpeg filter strings
});

const watermarkSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    text: Joi.string().max(100).required()
});

const gifSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}:\d{2}$/).default('00:00:00'),
    duration: Joi.number().min(1).max(10).default(5)
});

const fadeSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    type: Joi.string().valid('in', 'out', 'both').required(),
    duration: Joi.number().min(0.1).max(5).default(1)
});

const transcodeSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    format: Joi.string().valid('mp4', 'mov', 'avi', 'webm').required()
});

// --- NEW FEATURES (Text, Image, BG) ---
const addTextSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    text: Joi.string().min(1).max(100).required(),
    x: Joi.alternatives().try(Joi.string(), Joi.number()).default('(w-text_w)/2'),
    y: Joi.alternatives().try(Joi.string(), Joi.number()).default('(h-text_h)/2'),
    fontsize: Joi.number().min(10).max(200).default(24),
    fontcolor: Joi.string().default('white'),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}:\d{2}$/).default('00:00:00'),
    duration: Joi.number().min(1).default(5)
});

const addImageSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    x: Joi.alternatives().try(Joi.string(), Joi.number()).default(10),
    y: Joi.alternatives().try(Joi.string(), Joi.number()).default(10),
    scale: Joi.number().min(0.1).max(2).default(0.5),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}:\d{2}$/).default('00:00:00'),
    duration: Joi.number().min(1).default(5)
});

const removeBgSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
    color: Joi.string().default('0x00FF00'),
    similarity: Joi.number().min(0.01).max(1.0).default(0.3),
    blend: Joi.number().min(0.0).max(1.0).default(0.1)
});

const changeBgSchema = Joi.object({
    videoId: Joi.string().guid({ version: 'uuidv4' }).required(),
});

// ==========================================
// 3. Project Schemas
// ==========================================
const createProjectSchema = Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    description: Joi.string().allow('').optional(),
    settings: Joi.object({
        width: Joi.number().valid(1920, 1280, 720, 1080, 2160, 3840).required(),
        height: Joi.number().valid(1080, 720, 1920, 2160, 480).required(),
        fps: Joi.number().valid(24, 25, 30, 60).required()
    }).optional()
});

const saveProjectSchema = Joi.object({
    timelineData: Joi.object().required(),
    settings: Joi.object().optional(),
    thumbnail: Joi.string().optional()
});

const projectIdSchema = Joi.object({
    projectId: Joi.string().guid({ version: 'uuidv4' }).required()
});

const exportProjectSchema = Joi.object({
    format: Joi.string().valid('mp4', 'mov').default('mp4'),
    resolution: Joi.string().valid('1080p', '720p').default('1080p')
});

module.exports = {
    validateRequest,
    registerSchema,
    loginSchema,
    simpleVideoIdSchema,
    trimSchema,
    cropSchema,
    speedSchema,
    volumeSchema,
    mirrorSchema,
    mergeSchema,
    filterSchema,
    watermarkSchema,
    gifSchema,
    fadeSchema,
    transcodeSchema,
    addTextSchema,
    addImageSchema,
    removeBgSchema,
    changeBgSchema,
    createProjectSchema,
    saveProjectSchema,
    projectIdSchema,
    exportProjectSchema
};