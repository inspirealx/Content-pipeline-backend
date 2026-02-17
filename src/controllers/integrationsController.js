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
    testConnection,
    addLinkedInPages
};

async function addLinkedInPages(req, res, next) {
    try {
        const userId = req.user.userId;
        const { masterIntegrationId, selectedPages } = req.body;

        if (!masterIntegrationId || !selectedPages || !Array.isArray(selectedPages)) {
            throw new ApiError('masterIntegrationId and selectedPages (array) are required', 400);
        }

        // 1. Get Master Integration (Personal Profile) to retrieve access token
        const masterIntegration = await integrationsService.getDecryptedCredentials(userId, 'LINKEDIN');

        // We also need the integration record itself to verify ownership and ID
        const userIntegrations = await integrationsService.getIntegrationsByUserId(userId);
        const masterRecord = userIntegrations.find(i => i.id === masterIntegrationId);

        if (!masterRecord || !masterIntegration) {
            throw new ApiError('Master integration not found or unauthorized', 404);
        }

        const { accessToken, refreshToken, expiresAt } = masterIntegration;
        const results = [];

        // 2. Loop through pages and create new integrations
        for (const page of selectedPages) {
            // Check if already exists
            // We can't easily check by ID without decrypting everything, so we assume createIntegration handles duplicates 
            // OR we rely on the unique constraint if we had one on provider+personUrn (but we don't, only provider+userId)
            // So we might end up with duplicates if we're not careful. 
            // Ideally, `saveOAuthIntegration` should be used or checked against metadata.

            // Construct credentials for the Page
            const pageCredentials = {
                accessToken,
                refreshToken,
                expiresAt,
                personUrn: page.id // This is actually the Organization URN (urn:li:organization:123)
            };

            const pageMetadata = {
                name: page.name,
                picture: page.picture,
                accountType: 'PAGE',
                masterIntegrationId: masterIntegrationId,
                originalProfileId: masterRecord.metadata?.name // Track who authorized this
            };

            // Use the service to create/update
            // We need a custom logic here because `saveOAuthIntegration` does its own profile ID extraction
            // which might not work for just passing `page` object. 
            // So we call createIntegration directly.

            // To detect duplicates for PAGES, we should check metadata match if possible, 
            // but prisma schema doesn't index JSON. 
            // For now, valid use case: User re-adds pages. We can just create new ones or users can delete old ones.
            // Better: Check if an integration with this provider and this personUrn in encrypted credentials exists.
            // (Expensive).

            // Implementation: Just create for now.
            const newIntegration = await integrationsService.createIntegration(
                userId,
                'LINKEDIN',
                pageCredentials,
                pageMetadata
            );
            results.push(newIntegration);
        }

        res.status(201).json({ success: true, count: results.length, integrations: results });

    } catch (error) {
        next(error);
    }
}
