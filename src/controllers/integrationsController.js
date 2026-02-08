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
        const userId = req.user.userId;
        let { provider, credentials, integrationId } = req.body;

        // If integrationId is provided, fetch stored credentials
        if (integrationId) {
            const integration = await integrationsService.getIntegrationsByUserId(userId);
            const existingIntegration = integration.find(i => i.id === integrationId);

            if (!existingIntegration) {
                throw new ApiError('Integration not found', 404);
            }

            provider = existingIntegration.provider;
            // Get decrypted credentials for testing
            credentials = await integrationsService.getDecryptedCredentials(userId, provider);
        }

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
