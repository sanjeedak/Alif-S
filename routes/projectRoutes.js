// routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    validateRequest, 
    createProjectSchema, 
    saveProjectSchema, 
    projectIdSchema,
    exportProjectSchema 
} = require('../middleware/validators');

const { 
    createProject, 
    saveProject, 
    getMyProjects, 
    getProjectById, 
    deleteProject, 
    exportProject 
} = require('../controllers/projectController');

// Create (Validate Body)
router.post('/create', protect, validateRequest(createProjectSchema), createProject);

// Save (Validate Params AND Body)
router.put('/save/:projectId', 
    protect, 
    validateRequest(projectIdSchema, 'params'), // Check URL ID
    validateRequest(saveProjectSchema, 'body'), // Check JSON Data
    saveProject
); 

// Read All
router.get('/my-projects', protect, getMyProjects);

// Read One (Validate Params only) - ✅ This fixes your error
router.get('/:projectId', 
    protect, 
    validateRequest(projectIdSchema, 'params'), 
    getProjectById
);

// Export (Validate Params AND Body)
router.post('/:projectId/export', 
    protect, 
    validateRequest(projectIdSchema, 'params'), 
    validateRequest(exportProjectSchema, 'body'), 
    exportProject
);

// Delete (Validate Params)
router.delete('/:projectId', 
    protect, 
    validateRequest(projectIdSchema, 'params'), 
    deleteProject
);

module.exports = router;