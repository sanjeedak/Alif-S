const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const { deleteFile, createOutputPath } = require('../utils/fileHelper'); 
const { renderTimeline } = require('../utils/renderHelper');

// --- INTERNAL HELPERS ---
const getAbsolutePath = (rel) => {
    if (!rel) return null;
    return path.resolve(process.cwd(), rel); 
};

const AVAILABLE_FILTERS = { 
    'none': 'null',
    'noir': 'grayscale,eq=contrast=1.5:brightness=-0.1', 
    'vintage': 'sepia,curves=vintage',
    'vibrant': 'eq=saturation=1.6:contrast=1.1',
    'glow': 'unsharp=5:5:1.5:5:5:0.0,cas=0.5',
    'cool': 'colorbalance=rs=-0.2:gs=0.1:bs=0.4',
    'retro': 'curves=preset=vintage,noise=alls=5:allf=t+u',
    'sharp': 'unsharp=3:3:1.5:3:3:0.5',
    'invert': 'negate',
    'deep_color': 'eq=saturation=2:contrast=1.3:brightness=-0.05',
    'soft': 'boxblur=2:1',
    'warm': 'colorbalance=rs=0.3:gs=0.1:bs=-0.2'
};

const processVideo = (inputPath, outputPath, commandBuilder) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(inputPath)) {
            return reject(new Error(`Input file not found at: ${inputPath}`));
        }
        let command = ffmpeg(inputPath);
        command = commandBuilder(command);
        command
            .outputOptions('-preset ultrafast')
            .on('end', () => resolve(outputPath))
            .on('error', (err) => {
                if (fs.existsSync(outputPath)) deleteFile(outputPath);
                reject(new Error(`FFmpeg Error: ${err.message}`));
            })
            .save(outputPath);
    });
};

const saveVideoToDB = async (req, parentVideo, outputPath, label, format = null) => {
    const fileName = path.basename(outputPath);
    const dbPath = `uploads/${fileName}`; 

    return await Video.create({
        userId: req.user.id,
        parentId: parentVideo ? parentVideo.id : null,
        title: parentVideo ? `${label}: ${parentVideo.title}` : label,
        filename: fileName,
        filePath: dbPath,
        size: fs.statSync(outputPath).size,
        format: format || (parentVideo ? parentVideo.format : 'mp4'),
        thumbnail: parentVideo ? parentVideo.thumbnail : null,
        type: (format === 'mp3' || (parentVideo && parentVideo.type === 'audio')) ? 'audio' : 'video'
    });
};

// ==========================================
// 1. DYNAMIC API & VERSION CONTROL
// ==========================================
exports.getFiltersList = (req, res) => {
    const filters = Object.keys(AVAILABLE_FILTERS).map(key => ({
        id: key,
        label: key.charAt(0).toUpperCase() + key.slice(1)
    }));
    res.json({ success: true, filters });
};

exports.removeLastEdit = async (req, res) => {
    const { id } = req.params;
    try {
        const currentVideo = await Video.findByPk(id);
        if (!currentVideo || !currentVideo.parentId) return res.status(400).json({ message: "Invalid undo" });
        const parentVideo = await Video.findByPk(currentVideo.parentId);
        const absPath = getAbsolutePath(currentVideo.filePath);
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        await currentVideo.destroy();
        res.status(200).json({ success: true, data: parentVideo });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// ==========================================
// 2. TRANSFORM TOOLS (TRIM, CROP, SPEED, ROTATE, MIRROR)
// ==========================================
exports.trimVideo = async (req, res) => {
    const { videoId, startTime, duration } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => 
            cmd.setStartTime(startTime).setDuration(duration)
        );
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Trimmed') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.cropVideo = async (req, res) => {
    const { videoId, w, h, x, y } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => 
            cmd.videoFilters(`crop=${w}:${h}:${x}:${y}`)
        );
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Cropped') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.changeSpeed = async (req, res) => {
    const { videoId, speed } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => 
            cmd.videoFilters(`setpts=${1/speed}*PTS`).audioFilters(`atempo=${speed}`)
        );
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, `${speed}x Speed`) });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.rotateVideo = async (req, res) => {
    const { videoId } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => cmd.videoFilters('transpose=1'));
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Rotated') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.mirrorVideo = async (req, res) => {
    const { videoId, mode } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        const filter = mode === 'vertical' ? 'vflip' : 'hflip';
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => cmd.videoFilters(filter));
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Mirrored') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// ==========================================
// 3. OVERLAYS & BACKGROUND (IMAGE, TEXT, CHROMA KEY)
// ==========================================
exports.addImage = async (req, res) => {
    const { videoId, x, y, w, h } = req.body;
    if (!req.file) return res.status(400).json({ message: "Overlay file missing" });
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        const videoPath = getAbsolutePath(video.filePath);
        const imagePath = getAbsolutePath(req.file.path);

        await new Promise((resolve, reject) => {
            ffmpeg(videoPath).input(imagePath)
                .complexFilter([
                    `[1:v]scale=${w || 400}:${h || 300}[ovrl]`, 
                    `[0:v][ovrl]overlay=x=${x || 100}:y=${y || 100}`
                ])
                .on('end', resolve).on('error', reject).save(outputPath);
        });
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath); 
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Overlay Added') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.addText = async (req, res) => {
    const { videoId, text, x, y, fontsize, fontcolor } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        const fontPath = path.join(process.cwd(), 'assets/fonts/Arial.ttf').replace(/\\/g, '/');
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => 
            cmd.videoFilters({
                filter: 'drawtext',
                options: { text, fontfile: fontPath, fontsize: fontsize || 40, fontcolor: fontcolor || 'white', x: x || '(w-text_w)/2', y: y || '(h-text_h)/2' }
            })
        );
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Text Added') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.removeBackground = async (req, res) => {
    const { videoId, color } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => 
            cmd.videoFilters(`colorkey=${color || 'green'}:0.1:0.1`)
        );
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'BG Removed') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.changeBackground = async (req, res) => {
    const { videoId } = req.body;
    const bgFile = req.file; 
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await new Promise((resolve, reject) => {
            ffmpeg(bgFile.path).input(getAbsolutePath(video.filePath))
                .complexFilter(['[1:v]colorkey=green:0.1:0.1[ckout]', '[0:v]scale=1920:1080[bg]', '[bg][ckout]overlay=shortest=1'])
                .on('end', resolve).on('error', reject).save(outputPath);
        });
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'BG Changed') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// ==========================================
// 4. AUDIO TOOLS (MUTE, MIX, VOLUME, EXTRACT)
// ==========================================
exports.muteVideo = async (req, res) => {
    const { videoId } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => cmd.noAudio());
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Muted') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adjustVolume = async (req, res) => {
    const { videoId, volume } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => cmd.audioFilters(`volume=${volume}`));
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, `Vol ${volume}x`) });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.mixAudio = async (req, res) => {
    const { videoId } = req.body;
    const audioFile = req.file; 
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await new Promise((resolve, reject) => {
            ffmpeg(getAbsolutePath(video.filePath)).input(audioFile.path)
                .complexFilter(['[0:a][1:a]amix=inputs=2:duration=first'])
                .on('end', resolve).on('error', reject).save(outputPath);
        });
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Audio Mixed') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.extractAudio = async (req, res) => {
    const { videoId } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath('mp3');
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => 
            cmd.noVideo().audioCodec('libmp3lame')
        );
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Extracted Audio', 'mp3') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// ==========================================
// 5. EFFECTS & UTILS (FILTER, FADE, GIF, REVERSE, MERGE, TRANSCODE, REPLACE)
// ==========================================
exports.applyFilter = async (req, res) => {
    const { videoId, filterType } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        const filterString = AVAILABLE_FILTERS[filterType.toLowerCase()] || 'null';
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => cmd.videoFilters(filterString));
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, `Filter: ${filterType}`) });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.applyFade = async (req, res) => {
    const { videoId, duration } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => 
            cmd.videoFilters(`fade=t=in:st=0:d=${duration || 1},fade=t=out:st=5:d=${duration || 1}`)
        );
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Fade Applied') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.convertToGif = async (req, res) => {
    const { videoId } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath('gif');
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => 
            cmd.outputOptions('-vf', 'fps=10,scale=320:-1:flags=lanczos')
        );
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'GIF Export', 'gif') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.reverseVideo = async (req, res) => {
    const { videoId } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(video.format);
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => 
            cmd.videoFilters('reverse').audioFilters('areverse')
        );
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Reversed') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.mergeVideos = async (req, res) => {
    const { timelineData, settings } = req.body;
    try {
        if (!timelineData?.tracks?.length) return res.status(400).json({ message: "No tracks" });
        const videoIds = timelineData.tracks.map(c => typeof c === 'object' ? c.videoId : c);
        const audioIds = timelineData.audioTracks?.map(a => typeof a === 'object' ? a.videoId : a) || [];
        const outputPath = await renderTimeline(videoIds, settings || { width: 1920, height: 1080 }, audioIds);
        const firstVideo = await Video.findByPk(videoIds[0]);
        res.json({ success: true, data: await saveVideoToDB(req, firstVideo, outputPath, 'Final Merge') });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.transcodeVideo = async (req, res) => {
    const { videoId, format } = req.body;
    try {
        const video = await Video.findByPk(videoId);
        const outputPath = createOutputPath(format || 'mp4');
        await processVideo(getAbsolutePath(video.filePath), outputPath, (cmd) => cmd.format(format || 'mp4'));
        res.json({ success: true, data: await saveVideoToDB(req, video, outputPath, 'Transcoded', format) });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.replaceVideoContent = async (req, res) => {
    try {
        const video = await Video.findByPk(req.params.id);
        deleteFile(getAbsolutePath(video.filePath));
        const rel = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
        await video.update({ filename: req.file.filename, filePath: rel });
        res.json({ success: true, data: video });
    } catch (err) { res.status(500).json({ message: err.message }); }
};