const Project = require('../models/Project');
const Video = require('../models/Video');
const { renderTimeline } = require('../utils/renderHelper');
const path = require('path');
const fs = require('fs');

// 1️⃣ CREATE PROJECT
exports.createProject = async (req, res) => {
    try {
        const { title, name, description, settings } = req.body;

        const project = await Project.create({
            userId: req.user.id,
            title: title || name || `Project ${Date.now()}`,
            description: description || '',
            settings: settings || { width: 1920, height: 1080, fps: 30 },
            timelineData: { tracks: [], audioTracks: [] }
        });

        res.status(201).json({ success: true, project });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 2️⃣ SAVE PROJECT
exports.saveProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { timelineData, settings, thumbnail, title } = req.body;

        const project = await Project.findOne({
            where: { id: projectId, userId: req.user.id }
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (timelineData) project.timelineData = timelineData;
        if (settings) project.settings = settings;
        if (thumbnail) project.thumbnail = thumbnail;
        if (title) project.title = title;

        await project.save();
        res.json({ success: true, project });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 3️⃣ GET ALL PROJECTS
exports.getMyProjects = async (req, res) => {
    const projects = await Project.findAll({
        where: { userId: req.user.id },
        order: [['updatedAt', 'DESC']],
        attributes: ['id', 'title', 'description', 'thumbnail', 'updatedAt']
    });
    res.json(projects);
};

// 4️⃣ GET ONE PROJECT
exports.getProjectById = async (req, res) => {
    const project = await Project.findOne({
        where: { id: req.params.projectId, userId: req.user.id }
    });

    if (!project) {
        return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project);
};

// 5️⃣ DELETE PROJECT
exports.deleteProject = async (req, res) => {
    const deleted = await Project.destroy({
        where: { id: req.params.projectId, userId: req.user.id }
    });

    if (!deleted) {
        return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ message: 'Project deleted' });
};

// controllers/projectController.js

exports.exportProject = async (req, res) => {
    try {
        const { format = 'mp4' } = req.body; 
        
        const project = await Project.findOne({
            where: { id: req.params.projectId, userId: req.user.id }
        });

        if (!project) return res.status(404).json({ message: 'Project not found' });

        const rawTracks = project.timelineData?.tracks || [];
        if (rawTracks.length === 0) {
            return res.status(400).json({ message: 'Timeline is empty. Please add clips.' });
        }

        // 🔥 FIX: Ensure we only pass IDs and check file existence
        const clips = await Promise.all(rawTracks.map(async (clip) => {
            // clip object se sirf videoId nikalna hai
            const id = typeof clip === 'object' ? clip.videoId : clip;
            const videoAsset = await Video.findByPk(id);
            
            if (!videoAsset) {
                console.error(`Asset not found in DB for ID: ${id}`);
                return null;
            }

            // Path normalize karein
            const absolutePath = path.resolve(videoAsset.filePath); 
            if (!fs.existsSync(absolutePath)) {
                console.error(`File missing on disk: ${absolutePath}`);
                return null;
            }

            return { ...clip, path: absolutePath };
        }));

        const validClips = clips.filter(c => c !== null);
        if (validClips.length === 0) {
            return res.status(400).json({ message: 'One or more video files are missing on the server.' });
        }

        // 2. Renderer call
        const outputPath = await renderTimeline(validClips, { ...project.settings, format });

        const relativePath = path.relative(process.cwd(), outputPath).replace(/\\/g, '/');

        const video = await Video.create({
            userId: req.user.id,
            title: `Export: ${project.title}.${format}`,
            filename: path.basename(relativePath),
            filePath: relativePath,
            size: fs.statSync(outputPath).size,
            format: format
        });

        res.json({ success: true, video }); 
    } catch (err) {
        console.error("Export Error:", err);
        res.status(500).json({ message: err.message });
    }
};