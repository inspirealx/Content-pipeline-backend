// src/controllers/integrationsController.js
const integrationsService = require('../services/integrationsService');
const ApiError = require('../utils/ApiError');

async function createIntegration(req, res, next) {
    try {
        const userId = req.user.userId;
        const { provider, credentials, metadata } = req.body;

        // Validation
        const ALLOWED_PROVIDERS = ['GEMINI', 'OPENAI', 'ELEVENLABS', 'HEYGEN', 'TWITTER', 'LINKEDIN', 'WORDPRESS', 'OTHER'];
        if (!ALLOWED_PROVIDERS.includes(provider)) {
            throw new ApiError('Invalid provider', 400);
        }

        const integration = await integrationsService.createIntegration(userId, provider, credentials, metadata);
        res.status(201).json(integration);
    } catch (error) {
        next(error);
    }
}

async function getIntegrations(req, res, next) {
    try {
        const userId = req.user.userId;
        const integrations = await integrationsService.getIntegrationsByUserId(userId);
        res.json({ integrations });
    } catch (error) {
        next(error);
    }
}

async function updateIntegration(req, res, next) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const updates = req.body;

        const integration = await integrationsService.updateIntegration(id, userId, updates);
        res.json(integration);
    } catch (error) {
        next(error);
    }
}

async function deleteIntegration(req, res, next) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        await integrationsService.deleteIntegration(id, userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
}

async function testConnection(req, res, next) {
    try {
        // Can test provided credentials OR existing integration
        // The request body shows: { provider, credentials } for ad-hoc test?
        // Or if ID provided, use that.
        // The prompt implies ad-hoc test validation before save: "Validate API credentials"
        const { provider, credentials } = req.body;

        if (!provider || !credentials) {
            throw new ApiError('Provider and credentials required for testing', 400);
        }

        const result = await integrationsService.testIntegrationConnection(provider, credentials);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createIntegration,
    getIntegrations,
    updateIntegration,
    deleteIntegration,
    testConnection
};
