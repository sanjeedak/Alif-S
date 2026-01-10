const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Video = sequelize.define('Video', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    parentId: { 
        type: DataTypes.UUID, 
        allowNull: true
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
    thumbnail: {  // <--- NEW COLUMN
        type: DataTypes.STRING,
        allowNull: true // Old videos won't have it immediately
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