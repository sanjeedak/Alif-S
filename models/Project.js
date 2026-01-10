// models/Project.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Project = sequelize.define(
    'Project',
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },

        userId: {
            type: DataTypes.UUID,
            allowNull: false
        },

        title: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'Untitled Project'
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        timelineData: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: {
                tracks: [],
                audioTracks: []
            }
        },

        settings: {
            type: DataTypes.JSON,
            defaultValue: {
                width: 1920,
                height: 1080,
                fps: 30
            }
        },

        resolution: {
            type: DataTypes.STRING,
            defaultValue: '1080p'
        },

        thumbnail: {
            type: DataTypes.STRING,
            allowNull: true
        }
    },
    {
        tableName: 'Projects',
        timestamps: true,

        // ✅ FIX: Explicit & minimal indexes (NO explosion)
        indexes: [
            {
                fields: ['userId']
            },
            {
                fields: ['updatedAt']
            }
        ]
    }
);

// Associations (safe)
Project.associate = (models) => {
    Project.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE'
    });
};

module.exports = Project;
