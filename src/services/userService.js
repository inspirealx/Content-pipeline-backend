// src/services/userService.js
const prisma = require('../db/prismaClient');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');

const defaultPreferences = {
    contentGeneration: {
        defaultTone: 'professional',
        defaultLength: 'medium',
        defaultPlatforms: ['ARTICLE', 'LINKEDIN'],
        autoFix: true
    },
    aiModel: {
        preferred: 'GEMINI',
        temperature: 0.7,
        maxTokens: 2000
    },
    notifications: {
        publishSuccess: true,
        publishFailure: true,
        weeklySummary: true
    }
};

async function getUserProfile(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            createdAt: true,
            updatedAt: true
        }
    });

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    return user;
}

async function updateUserProfile(userId, updates) {
    const { name, currentPassword, newPassword, avatar } = updates;

    // If password change requested, verify current password
    if (newPassword) {
        if (!currentPassword) {
            throw new ApiError('Current password required to change password', 400);
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            throw new ApiError('Current password is incorrect', 401);
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash }
        });
    }

    // Update other fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;

    if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
            where: { id: userId },
            data: updateData
        });
    }

    return await getUserProfile(userId);
}

async function getUserPreferences(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true }
    });

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    // Return user preferences or defaults
    return user.preferences || defaultPreferences;
}

async function updateUserPreferences(userId, newPreferences) {
    // Validate preferences
    validatePreferences(newPreferences);

    // Get existing preferences
    const current = await getUserPreferences(userId);

    // Deep merge
    const merged = deepMerge(current, newPreferences);

    // Update user
    await prisma.user.update({
        where: { id: userId },
        data: { preferences: merged }
    });

    return merged;
}

function validatePreferences(prefs) {
    if (prefs.contentGeneration) {
        const { defaultTone, defaultLength, defaultPlatforms } = prefs.contentGeneration;

        const validTones = ['professional', 'casual', 'friendly', 'formal'];
        if (defaultTone && !validTones.includes(defaultTone)) {
            throw new ApiError(`Invalid tone. Must be one of: ${validTones.join(', ')}`, 400);
        }

        const validLengths = ['short', 'medium', 'long'];
        if (defaultLength && !validLengths.includes(defaultLength)) {
            throw new ApiError(`Invalid length. Must be one of: ${validLengths.join(', ')}`, 400);
        }

        const validPlatforms = ['ARTICLE', 'TWITTER', 'LINKEDIN', 'REEL_SCRIPT'];
        if (defaultPlatforms && Array.isArray(defaultPlatforms)) {
            for (const platform of defaultPlatforms) {
                if (!validPlatforms.includes(platform)) {
                    throw new ApiError(`Invalid platform: ${platform}`, 400);
                }
            }
        }
    }

    if (prefs.aiModel) {
        const { temperature, preferred } = prefs.aiModel;

        if (temperature !== undefined && (temperature < 0 || temperature > 1)) {
            throw new ApiError('Temperature must be between 0 and 1', 400);
        }

        const validModels = ['GEMINI', 'OPENAI'];
        if (preferred && !validModels.includes(preferred)) {
            throw new ApiError(`Invalid AI model. Must be one of: ${validModels.join(', ')}`, 400);
        }
    }
}

function deepMerge(target, source) {
    const output = { ...target };

    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            output[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            output[key] = source[key];
        }
    }

    return output;
}

module.exports = {
    getUserProfile,
    updateUserProfile,
    getUserPreferences,
    updateUserPreferences,
    defaultPreferences
};
