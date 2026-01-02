const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db'); 

const Video = sequelize.define('Video', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    parentId: { // <--- 🆕 यह नया कॉलम है (Undo के लिए)
        type: DataTypes.STRING,
        allowNull: true // ओरिजिनल वीडियो का कोई पैरेंट नहीं होता
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    filename: {
        type: DataTypes.STRING,
        allowNull: false
    },
    filePath: {
        type: DataTypes.STRING,
        allowNull: false
    },
    size: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    format: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: true
});

module.exports = Video;