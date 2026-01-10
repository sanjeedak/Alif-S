const fs = require('fs');
const path = require('path');

/**
 * Safely deletes a file if it exists.
 * @param {String} filePath - Full path to the file
 */
const deleteFile = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted file: ${path.basename(filePath)}`);
            return true;
        }
    } catch (err) {
        console.error(`⚠️ Failed to delete file ${filePath}:`, err.message);
    }
    return false;
};

/**
 * Generates a unique output path for new video operations.
 * @param {String} ext - File extension (e.g., 'mp4')
 * @returns {String} Full path
 */
const createOutputPath = (ext) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `vn_${Date.now()}.${ext}`);
};

module.exports = { deleteFile, createOutputPath };