// src/services/integrationOauthService.js
const prisma = require('../db/prismaClient');
const integrationsService = require('./integrationsService');
const ApiError = require('../utils/ApiError');

/**
 * Save OAuth integration for social media publishing
 */
async function saveOAuthIntegration(userId, provider, profile, tokens) {
    try {
        // Prepare credentials based on provider
        let credentials = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt
        };

        let metadata = {};

        // Provider-specific data extraction
        switch (provider.toUpperCase()) {
            case 'LINKEDIN':
                // Check if it's a person or organization URN
                const id = profile.id;
                const isOrg = id.startsWith('urn:li:organization:');

                // Ensure correct URN format (mostly for persons if not already URN)
                if (isOrg) {
                    credentials.personUrn = id; // Keeping key as personUrn for compatibility, though it's an org
                    metadata.accountType = 'PAGE';
                } else {
                    credentials.personUrn = id.startsWith('urn:li:person:') ? id : `urn:li:person:${id}`;
                    metadata.accountType = 'PROFILE';
                }

                metadata.name = profile.displayName;
                metadata.email = profile.emails?.[0]?.value;
                metadata.picture = profile.photos?.[0]?.value;
                break;

            case 'TWITTER':
                credentials.userId = profile.id;
                metadata.username = profile.username;
                metadata.name = profile.displayName;
                break;

            case 'FACEBOOK':
                credentials.userId = profile.id;
                metadata.name = profile.displayName;
                metadata.email = profile.emails?.[0]?.value;
                break;
        }

        // Check if integration already exists for this user and provider
        const existing = await prisma.integration.findFirst({
            where: {
                userId,
                provider: provider.toUpperCase()
            }
        });

        if (existing) {
            // Update existing integration with new tokens
            const updated = await integrationsService.updateIntegrationCredentials(
                existing.id,
                userId,
                credentials,
                metadata
            );
            return updated;
        }

        // Create new integration
        const integration = await integrationsService.createIntegration(
            userId,
            provider.toUpperCase(),
            credentials,
            metadata
        );

        return integration;
    } catch (error) {
        console.error('Error saving OAuth integration:', error);
        throw new ApiError(
            'Failed to save integration',
            500,
            'OAUTH_SAVE_FAILED',
            'Failed to connect your account. Please try again.',
            null,
            { provider }
        );
    }
}

module.exports = {
    saveOAuthIntegration
};
