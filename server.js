const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const fs = require('fs');       
const path = require('path');   
require('dotenv').config();

const { connectDB } = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const seedSfx = require('./utils/seeder');
const initCron = require('./utils/cronScheduler');

// Routes
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const assetRoutes = require('./routes/assetRoutes');
const projectRoutes = require('./routes/projectRoutes'); 

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. Initialization Logic (Fixed Folders) ---
const ensureDirectories = () => {
    const dirs = [
        'uploads', 
        'uploads/originals', 
        'uploads/thumbnails',
        'uploads/images',
        'uploads/audio', // Added for Audio support
        'public/temp', 
        'assets/sfx'
    ];
    dirs.forEach(dir => {
        const fullPath = path.join(__dirname, dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    });
};
ensureDirectories();
initCron();

// --- 2. Security Middleware ---
app.use(helmet({ 
    crossOriginResourcePolicy: { policy: "cross-origin" } 
})); 
app.use(cors());   

// 🔥 FIX: Limit badhayein taaki heavy timelineData merge ke waqt block na ho
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(morgan('dev'));
app.use(hpp());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, 
    max: 500, // Limit badhayein editing ke waqt requests zyada hoti hain
    message: 'Too many requests, please try again later.'
});
app.use('/api', limiter);

// Database Connection
connectDB();

// --- 3. Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);     
app.use('/api/projects', projectRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/assets', assetRoutes);

// --- 4. Static Files (Fixed Paths) ---
// Frontend in paths se thumbnails aur assets load karega
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/sounds', express.static(path.join(__dirname, 'assets/sfx')));

app.get('/', (req, res) => {
    res.json({ 
        success: true,
        message: 'AlifS Video Editor API', 
        status: 'Operational',
        version: '1.1.0'
    });
});

// Centralized Error Handling
app.use(errorHandler);

// --- 5. Server Start ---
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    // SFX Seeder check
    try {
        const sfxDir = path.join(__dirname, 'assets/sfx');
        if (fs.existsSync(sfxDir)) {
            const sfxFiles = fs.readdirSync(sfxDir);
            if (sfxFiles.length < 2) seedSfx();
        }
    } catch (err) {
        console.log("Seeding skipped: Folder not ready.");
    }
});

// Crash prevention
process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection: ${err.message}`);
});