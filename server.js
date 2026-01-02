const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// 1. Import Database Connection
const { connectDB } = require('./config/db');

// 2. Import Routes
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const editRoutes = require('./routes/editRoutes');

const app = express();

// --- Middleware ---
app.use(helmet()); 
app.use(cors());   
app.use(express.json()); 
app.use(morgan('dev'));  

// --- Database Connection ---
connectDB();

// --- API Routes ---
// This connects your authController to the web
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/api/edit', editRoutes);
// Basic Test Route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to AlifS Video Editor API', 
        status: 'Running',
        version: '1.0.0'
    });
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 AlifS Server running on port ${PORT}`);
});