const axios = require('axios');
const fs = require('fs');
const path = require('path');

const sfxDir = path.join(__dirname, '../assets/sfx');

const defaultSounds = [
    { name: 'beep.mp3', url: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
    { name: 'button.mp3', url: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg' },
    { name: 'camera.mp3', url: 'https://actions.google.com/sounds/v1/cartoon/camera_snap.ogg' },
    { name: 'applause.mp3', url: 'https://actions.google.com/sounds/v1/crowds/applause_small_people.ogg' },
    { name: 'laughter.mp3', url: 'https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg' }
];

const seedSfx = async () => {
    try {
        if (!fs.existsSync(sfxDir)) {
            fs.mkdirSync(sfxDir, { recursive: true });
        }

        // ❌ Maine "Force Delete" wala logic yahan se hata diya hai

        console.log('🔄 Checking SFX...');

        for (const sound of defaultSounds) {
            const filePath = path.join(sfxDir, sound.name);
            
            // ✅ SIMPLE CHECK: Agar file hai, to aage badho (kuch mat karo)
            if (fs.existsSync(filePath)) {
                console.log(`⏭️ Skipped (Already exists): ${sound.name}`);
                continue; 
            }

            // Agar file nahi hai, to download shuru karo
            console.log(`⬇️ Downloading: ${sound.name}...`);
            const writer = fs.createWriteStream(filePath);

            try {
                const response = await axios({
                    url: sound.url,
                    method: 'GET',
                    responseType: 'stream'
                });

                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                console.log(`✅ Success: ${sound.name}`);
            } catch (downloadError) {
                console.error(`❌ FAILED: ${sound.name}`);
            }
        }
        console.log('🎉 SFX Check Complete!');

    } catch (error) {
        console.error('❌ Error in Seeder:', error.message);
    }
};

module.exports = seedSfx;