// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
    getProfile,
    updateProfile,
    getPreferences,
    updatePreferences,
    getUserProfileWithNiche,
    updateUserNiche
} = require('../controllers/userController');

router.use(authenticateToken);

router.get('/profile', getProfile);
router.get('/profile/niche', getUserProfileWithNiche); // Get profile with niche
router.patch('/profile', updateProfile);
router.put('/niche', updateUserNiche); // Update user niche
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);

module.exports = router;
