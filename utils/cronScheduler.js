// utils/cronScheduler.js
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const cleanOldFiles = () => {
    // Folders to clean (Don't clean 'originals' or 'assets')
    const foldersToClean = [
        path.join(__dirname, '../uploads'), // Processed exports
        path.join(__dirname, '../public/temp') // Temp merge files
    ];

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    console.log('🧹 [CRON] Starting daily cleanup...');

    foldersToClean.forEach(dir => {
        if (!fs.existsSync(dir)) return;

        fs.readdir(dir, (err, files) => {
            if (err) return console.error(`[CRON] Error reading ${dir}:`, err);

            files.forEach(file => {
                const filePath = path.join(dir, file);
                
                // Skip directories (like 'originals' folder inside uploads)
                if (fs.lstatSync(filePath).isDirectory()) return;

                fs.stat(filePath, (err, stats) => {
                    if (err) return;

                    const now = Date.now();
                    const endTime = new Date(stats.mtime).getTime() + ONE_DAY_MS;

                    if (now > endTime) {
                        fs.unlink(filePath, (err) => {
                            if (err) console.error(`[CRON] Failed to delete ${file}`);
                            else console.log(`🗑️ [CRON] Deleted old file: ${file}`);
                        });
                    }
                });
            });
        });
    });
};

// Schedule task to run every day at midnight (00:00)
const initCron = () => {
    cron.schedule('0 0 * * *', cleanOldFiles);
    console.log('🕒 Cron Scheduler Initialized');
};

module.exports = initCron;