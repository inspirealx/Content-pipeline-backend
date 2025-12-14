// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
    getProfile,
    updateProfile,
    getPreferences,
    updatePreferences
} = require('../controllers/userController');

router.use(authenticateToken);

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);

module.exports = router;
