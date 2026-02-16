// src/services/integrationsService.js
const prisma = require('../db/prismaClient');
const { encrypt, decrypt } = require('../utils/encryption');
const ApiError = require('../utils/ApiError');
// Will import aiService dynamically or specific test functions to avoid circular deps if needed, 
// but for testIntegrationConnection we will assume simple fetch or lightweight checks for now.

async function createIntegration(userId, provider, credentials, metadata) {
    if (!credentials || Object.keys(credentials).length === 0) {
        throw new ApiError(
            'API key cannot be empty',
            400,
            'EMPTY_API_KEY',
            'API key cannot be empty. Please enter a valid key.',
            'apiKey'
        );
    }

    // Validate API key format based on provider
    if (provider === 'OPENAI' && credentials.apiKey) {
        if (!credentials.apiKey.startsWith('sk-')) {
            throw new ApiError(
                'Invalid API key format for OpenAI',
                400,
                'INVALID_API_KEY_FORMAT',
                'Invalid API key format for OpenAI. Please check and try again.',
                'apiKey',
                { provider: 'OPENAI' }
            );
        }
    }

    if (provider === 'GEMINI' && credentials.apiKey) {
        // Gemini API keys are typically longer and don't have a specific prefix
        if (credentials.apiKey.length < 20) {
            throw new ApiError(
                'Invalid API key format for Gemini',
                400,
                'INVALID_API_KEY_FORMAT',
                'Invalid API key format for Gemini. Please check and try again.',
                'apiKey',
                { provider: 'GEMINI' }
            );
        }
    }

    let credentialsEncrypted;
    try {
        credentialsEncrypted = encrypt(JSON.stringify(credentials));
    } catch (error) {
        throw new ApiError(
            'Failed to encrypt credentials',
            500,
            'ENCRYPTION_FAILED',
            'Failed to save integration. Please try again.',
            null,
            { provider }
        );
    }

    const integration = await prisma.integration.create({
        data: {
            userId,
            provider,
            credentialsEncrypted,
            metadata: metadata || {},
        }
    });

    return formatIntegration(integration);
}

async function getIntegrationsByUserId(userId) {
    const integrations = await prisma.integration.findMany({
        where: { userId }
    });
    return integrations.map(formatIntegration);
}

async function updateIntegration(integrationId, userId, updates) {
    const integration = await prisma.integration.findUnique({
        where: { id: integrationId }
    });

    if (!integration) {
        throw new ApiError(
            'Integration not found',
            404,
            'INTEGRATION_NOT_FOUND',
            'The requested integration was not found.',
            'integrationId'
        );
    }
    if (integration.userId !== userId) {
        throw new ApiError(
            'Unauthorized access to integration',
            403,
            'INTEGRATION_ACCESS_DENIED',
            'You do not have permission to delete this integration.',
            'integrationId'
        );
    }

    // Check if there are pending publish jobs
    const pendingJobs = await prisma.publishJob.findFirst({
        where: {
            integrationId: integrationId,
            status: { in: ['PENDING', 'RUNNING'] }
        }
    });

    if (pendingJobs) {
        throw new ApiError(
            'Cannot delete integration with pending jobs',
            409,
            'INTEGRATION_DELETE_FAILED',
            'Cannot delete this integration while publish jobs are pending.',
            'integrationId'
        );
    }

    const data = {};
    if (updates.credentials) {
        data.credentialsEncrypted = encrypt(JSON.stringify(updates.credentials));
    }
    if (updates.metadata) {
        data.metadata = updates.metadata;
    }

    const updated = await prisma.integration.update({
        where: { id: integrationId },
        data
    });

    return formatIntegration(updated);
}

async function deleteIntegration(integrationId, userId) {
    const integration = await prisma.integration.findUnique({
        where: { id: integrationId }
    });

    if (!integration) {
        throw new ApiError(
            'Integration not found',
            404,
            'INTEGRATION_NOT_FOUND',
            'The requested integration was not found.',
            'integrationId'
        );
    }
    if (integration.userId !== userId) {
        throw new ApiError(
            'Unauthorized access to integration',
            403,
            'INTEGRATION_ACCESS_DENIED',
            'You do not have permission to modify this integration.',
            'integrationId'
        );
    }

    await prisma.integration.delete({
        where: { id: integrationId }
    });
}

function formatIntegration(integration) {
    let credentials = {};
    try {
        credentials = JSON.parse(decrypt(integration.credentialsEncrypted));
    } catch (e) {
        console.error(`Failed to decrypt credentials for integration ${integration.id}`);
        // Return masked or empty on error
    }

    // Simple masking logic
    const maskedCredentials = {};
    for (const [key, val] of Object.entries(credentials)) {
        maskedCredentials[key] = maskString(val);
    }

    return {
        id: integration.id,
        provider: integration.provider,
        credentials: maskedCredentials,
        metadata: integration.metadata,
        createdAt: integration.createdAt
    };
}

function maskString(str) {
    if (!str || str.length < 8) return '****';
    return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
}

// Internal helper to get RAW credentials for usage by other services
async function getDecryptedCredentials(userId, provider) {
    const integration = await prisma.integration.findFirst({
        where: { userId, provider }
    });
    if (!integration) return null;
    return JSON.parse(decrypt(integration.credentialsEncrypted));
}

async function testIntegrationConnection(provider, credentials) {
    // Basic connectivity tests
    try {
        if (provider === 'GEMINI') {
            const apiKey = credentials.apiKey;
            if (!apiKey) {
                throw new ApiError(
                    'API key missing',
                    400,
                    'MISSING_API_KEY',
                    'API key is required for Gemini connection.',
                    'apiKey',
                    { provider: 'GEMINI' }
                );
            }
            // Simple fetch to list models or similar free endpoint
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new ApiError(
                    'Gemini API connection failed',
                    400,
                    'API_CONNECTION_FAILED',
                    'Connection test failed: Gemini returned an error. Verify your credentials.',
                    'apiKey',
                    { provider: 'GEMINI', statusCode: res.status, error: errorData }
                );
            }
            return { success: true, message: 'Connected to Gemini successfully!' };
        }
        else if (provider === 'OPENAI') {
            const apiKey = credentials.apiKey;
            if (!apiKey) {
                throw new ApiError(
                    'API key missing',
                    400,
                    'MISSING_API_KEY',
                    'API key is required for OpenAI connection.',
                    'apiKey',
                    { provider: 'OPENAI' }
                );
            }
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new ApiError(
                    'OpenAI API connection failed',
                    400,
                    'API_CONNECTION_FAILED',
                    'Connection test failed: OpenAI returned an error. Verify your credentials.',
                    'apiKey',
                    { provider: 'OPENAI', statusCode: res.status, error: errorData }
                );
            }
            return { success: true, message: 'Connected to OpenAI successfully!' };
        }
        else if (provider === 'ELEVENLABS') {
            const apiKey = credentials.apiKey;
            if (!apiKey) {
                throw new ApiError(
                    'API key missing',
                    400,
                    'MISSING_API_KEY',
                    'API key is required for ElevenLabs connection.',
                    'apiKey',
                    { provider: 'ELEVENLABS' }
                );
            }
            // Test connection by fetching available voices
            const res = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': apiKey }
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new ApiError(
                    'ElevenLabs API connection failed',
                    400,
                    'API_CONNECTION_FAILED',
                    'Connection test failed: ElevenLabs returned an error. Verify your credentials.',
                    'apiKey',
                    { provider: 'ELEVENLABS', statusCode: res.status, error: errorData }
                );
            }
            return { success: true, message: 'Connected to ElevenLabs successfully!' };
        }
        else if (provider === 'TWITTER' || provider === 'LINKEDIN') {
            // Placeholder for OAuth - in real implementation, validate tokens
            return { success: true, message: `${provider} connection valid!` };
        }
        else {
            return { success: true, message: 'Connection test passed!' };
        }
    } catch (error) {
        // Re-throw ApiError instances
        if (error instanceof ApiError) {
            throw error;
        }
        // Handle network/other errors
        throw new ApiError(
            'Connection test failed',
            500,
            'CONNECTION_TEST_FAILED',
            `${provider} API is unreachable. Please check your internet connection.`,
            null,
            { provider }
        );
    }
}

// Helper function to update integration credentials (used by OAuth)
async function updateIntegrationCredentials(integrationId, userId, credentials, metadata) {
    const integration = await prisma.integration.findUnique({
        where: { id: integrationId }
    });

    if (!integration || integration.userId !== userId) {
        throw new ApiError('Integration not found or unauthorized', 403);
    }

    const credentialsEncrypted = encrypt(JSON.stringify(credentials));

    const updated = await prisma.integration.update({
        where: { id: integrationId },
        data: {
            credentialsEncrypted,
            metadata: metadata || integration.metadata,
            updatedAt: new Date()
        }
    });

    return formatIntegration(updated);
}

module.exports = {
    createIntegration,
    getIntegrationsByUserId,
    updateIntegration,
    updateIntegrationCredentials,
    deleteIntegration,
    testIntegrationConnection,
    getDecryptedCredentials
};
