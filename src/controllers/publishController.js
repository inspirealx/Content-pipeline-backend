// src/controllers/publishController.js
const publishService = require('../services/publishService');
const videoService = require('../services/videoService');
const ApiError = require('../utils/ApiError');

async function publishContent(req, res, next) {
    try {
        const userId = req.user.userId;
        const { versionId, integrationIds, scheduledFor, metadata } = req.body;

        if (!versionId || !integrationIds || !Array.isArray(integrationIds)) {
            throw new ApiError('versionId and integrationIds (array) are required', 400);
        }

        const jobs = await publishService.createPublishJobs(
            userId,
            versionId,
            integrationIds,
            scheduledFor,
            metadata
        );

        res.status(201).json({ jobs });
    } catch (error) {
        next(error);
    }
}

async function getPublishQueue(req, res, next) {
    try {
        const userId = req.user.userId;
        const { status } = req.query;

        const filters = {};
        if (status) filters.status = status;

        const jobs = await publishService.getPublishJobs(userId, filters);
        res.json({ jobs });
    } catch (error) {
        next(error);
    }
}

async function retryPublish(req, res, next) {
    try {
        const userId = req.user.userId;
        const { jobId } = req.params;

        const result = await publishService.retryPublishJob(jobId, userId);
        res.json({
            ...result,
            message: 'Publish job queued for retry'
        });
    } catch (error) {
        next(error);
    }
}

async function generateVideo(req, res, next) {
    try {
        const userId = req.user.userId;
        const { versionId, provider, params } = req.body;

        if (!versionId || !provider) {
            throw new ApiError('versionId and provider are required', 400);
        }

        // Validate provider
        const VALID_PROVIDERS = ['ELEVENLABS', 'HEYGEN'];
        if (!VALID_PROVIDERS.includes(provider)) {
            throw new ApiError('Invalid provider. Must be ELEVENLABS or HEYGEN', 400);
        }

        const job = await videoService.createVideoJob(userId, versionId, provider, params || {});

        res.status(201).json({
            jobId: job.id,
            status: job.status,
            message: 'Video generation started'
        });
    } catch (error) {
        next(error);
    }
}

async function getVideoQueue(req, res, next) {
    try {
        const userId = req.user.userId;
        const { status } = req.query;

        const filters = {};
        if (status) filters.status = status;

        const jobs = await videoService.getVideoJobs(userId, filters);
        res.json({ jobs });
    } catch (error) {
        next(error);
    }
}

async function cancelPublish(req, res, next) {
    try {
        const userId = req.user.userId;
        const { jobId } = req.params;

        const result = await publishService.cancelPublishJob(jobId, userId);

        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function updateSchedule(req, res, next) {
    try {
        const userId = req.user.userId;
        const { jobId } = req.params;
        const { scheduledFor } = req.body;

        if (!scheduledFor) {
            throw new ApiError('scheduledFor is required', 400);
        }

        const updated = await publishService.updatePublishSchedule(jobId, userId, scheduledFor);

        res.json({
            id: updated.id,
            scheduledFor: updated.scheduledFor,
            status: updated.status
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    publishContent,
    getPublishQueue,
    retryPublish,
    generateVideo,
    getVideoQueue,
    cancelPublish,
    updateSchedule
};
