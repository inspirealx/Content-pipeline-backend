// src/controllers/analyticsController.js
const analyticsService = require('../services/analyticsService');
const ApiError = require('../utils/ApiError');

async function getDashboardStats(req, res, next) {
    try {
        const userId = req.user.userId;
        const stats = await analyticsService.getDashboardStatsForUser(userId);
        res.json({ stats: stats });
    } catch (error) {
        next(error);
    }
}

async function getContentPerformance(req, res, next) {
    try {
        const userId = req.user.userId;
        const { startDate, endDate } = req.query;

        const metrics = await analyticsService.getContentMetrics(userId, { startDate, endDate });
        res.json(metrics);
    } catch (error) {
        next(error);
    }
}

async function getPublishingAnalytics(req, res, next) {
    try {
        const userId = req.user.userId;
        const days = parseInt(req.query.days) || 30;

        if (days < 1 || days > 365) {
            throw new ApiError('Days must be between 1 and 365', 400);
        }

        const metrics = await analyticsService.getPublishingMetrics(userId, days);
        res.json(metrics);
    } catch (error) {
        next(error);
    }
}

async function getIntegrationHealth(req, res, next) {
    try {
        const userId = req.user.userId;
        const health = await analyticsService.checkIntegrationHealth(userId);
        res.json(health);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getDashboardStats,
    getContentPerformance,
    getPublishingAnalytics,
    getIntegrationHealth
};
