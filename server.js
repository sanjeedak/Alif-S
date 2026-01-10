const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit'); // NEW
const hpp = require('hpp'); // NEW: Prevent Parameter Pollution
const fs = require('fs');       
const path = require('path');   
require('dotenv').config();

// 1. Config & Utils
const { connectDB } = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const seedSfx = require('./utils/seeder');
const initCron = require('./utils/cronScheduler'); // NEW

// 2. Routes
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const assetRoutes = require('./routes/assetRoutes');
const projectRoutes = require('./routes/projectRoutes'); 

const app = express();
const PORT = process.env.PORT || 5000;

// --- Initialization Logic ---
const ensureDirectories = () => {
    const dirs = [
        'uploads', 'uploads/originals', 'uploads/proxies', 'uploads/thumbnails',
        'public/temp', 'assets/sfx','uploads/images',
    ];
    dirs.forEach(dir => {
        const fullPath = path.join(__dirname, dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    });
};
ensureDirectories();
initCron(); // Start the cleaner

// --- Middleware (Production Security) ---
app.use(helmet({ 
    crossOriginResourcePolicy: { policy: "cross-origin" } 
})); 
app.use(cors());   
app.use(express.json({ limit: '10kb' })); // Body limit to prevent DoS
app.use(morgan('dev'));
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Rate Limiting: Limit each IP to 100 requests per 10 minutes
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, 
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// --- Database ---
connectDB();

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);     
app.use('/api/projects', projectRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/assets', assetRoutes);

// --- Static Files ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/sounds', express.static(path.join(__dirname, 'assets/sfx')));

app.get('/', (req, res) => {
    res.json({ 
        success: true,
        message: 'AlifS Video Editor API - Production Ready', 
        status: 'Operational',
        version: '1.1.0'
    });
});

// --- Centralized Error Handling ---
app.use(errorHandler);

// --- Server Start ---
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    // Run seeder only if folder empty to avoid startup lag
    const sfxFiles = fs.readdirSync(path.join(__dirname, 'assets/sfx'));
    if(sfxFiles.length < 2) seedSfx();
});

// Handle Unhandled Promise Rejections (Crash prevention)
process.on('unhandledRejection', (err) => {
    console.log(` Unhandled Rejection: ${err.message}`);
    // Optional: server.close(() => process.exit(1));
});