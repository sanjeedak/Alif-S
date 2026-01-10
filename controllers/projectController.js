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

// 6️⃣ EXPORT PROJECT (🔥 MAIN FIX)
exports.exportProject = async (req, res) => {
    try {
        const project = await Project.findOne({
            where: { id: req.params.projectId, userId: req.user.id }
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const clips = Array.isArray(project.timelineData?.tracks)
            ? project.timelineData.tracks.filter(c => c.videoId)
            : [];

        if (clips.length === 0) {
            return res.status(400).json({ message: 'Timeline is empty' });
        }

        const clipIds = clips.map(c => c.videoId);

        const outputPath = await renderTimeline(clipIds, project.settings);

        // 🔥 ABSOLUTE ➜ RELATIVE PATH FIX
        const relativePath = path
            .relative(path.join(__dirname, '..'), outputPath)
            .replace(/\\/g, '/');

        const video = await Video.create({
            userId: req.user.id,
            title: `Export: ${project.title}`,
            filename: path.basename(relativePath),
            filePath: relativePath,
            size: fs.statSync(outputPath).size,
            format: 'mp4',
            thumbnail: project.thumbnail
        });

        res.json({ success: true, video });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Export failed', error: err.message });
    }
};
