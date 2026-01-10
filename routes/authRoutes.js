const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { validateRequest, registerSchema, loginSchema } = require('../middleware/validators');

router.post('/register', validateRequest(registerSchema), register);
router.post('/login',    validateRequest(loginSchema),    login);

module.exports = router;