const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db'); // Fix import here

const Video = sequelize.define('Video', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID, // <--- CHANGED TO UUID
        allowNull: false
    },
    parentId: {
        type: DataTypes.UUID, // <--- CHANGED TO UUID (for consistency)
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