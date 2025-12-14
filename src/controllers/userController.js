// src/controllers/userController.js
const userService = require('../services/userService');
const ApiError = require('../utils/ApiError');

async function getProfile(req, res, next) {
    try {
        const userId = req.user.userId;
        const profile = await userService.getUserProfile(userId);
        res.json(profile);
    } catch (error) {
        next(error);
    }
}

async function updateProfile(req, res, next) {
    try {
        const userId = req.user.userId;
        const updates = req.body;

        // Validate email if provided
        if (updates.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updates.email)) {
                throw new ApiError('Invalid email format', 400);
            }
        }

        const profile = await userService.updateUserProfile(userId, updates);
        res.json({
            ...profile,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        next(error);
    }
}

async function getPreferences(req, res, next) {
    try {
        const userId = req.user.userId;
        const preferences = await userService.getUserPreferences(userId);
        res.json(preferences);
    } catch (error) {
        next(error);
    }
}

async function updatePreferences(req, res, next) {
    try {
        const userId = req.user.userId;
        const newPreferences = req.body;

        const preferences = await userService.updateUserPreferences(userId, newPreferences);
        res.json({
            preferences,
            message: 'Preferences updated successfully'
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProfile,
    updateProfile,
    getPreferences,
    updatePreferences
};
