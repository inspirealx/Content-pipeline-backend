// src/controllers/integrationController.js
const integrationService = require('../services/integrationService');

async function addIntegration(req, res, next) {
    try {
        const { provider, apiKey } = req.body;
        const userId = req.user.userId;

        const integration = await integrationService.addIntegration(userId, provider, apiKey);
        res.status(201).json({ integration: { id: integration.id, provider: integration.provider, createdAt: integration.createdAt } });
    } catch (error) {
        next(error);
    }
}

async function getIntegrations(req, res, next) {
    try {
        const userId = req.user.userId;
        const integrations = await integrationService.getUserIntegrations(userId);
        res.json({ integrations });
    } catch (error) {
        next(error);
    }
}

module.exports = { addIntegration, getIntegrations };