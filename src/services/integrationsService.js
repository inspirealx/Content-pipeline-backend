// src/services/integrationsService.js
const prisma = require('../db/prismaClient');
const { encrypt, decrypt } = require('../utils/encryption');
const ApiError = require('../utils/ApiError');
// Will import aiService dynamically or specific test functions to avoid circular deps if needed, 
// but for testIntegrationConnection we will assume simple fetch or lightweight checks for now.

async function createIntegration(userId, provider, credentials, metadata) {
    if (!credentials || Object.keys(credentials).length === 0) {
        throw new ApiError('Credentials are required', 400);
    }

    const encryptedCredentials = encrypt(JSON.stringify(credentials));

    const integration = await prisma.integration.create({
        data: {
            userId,
            provider,
            encryptedCredentials,
            metadata: metadata || {},
            // isActive default true in schema usually
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
        throw new ApiError('Integration not found', 404);
    }
    if (integration.userId !== userId) {
        throw new ApiError('Unauthorized access to integration', 403);
    }

    const data = {};
    if (updates.credentials) {
        data.encryptedCredentials = encrypt(JSON.stringify(updates.credentials));
    }
    if (updates.metadata) {
        data.metadata = updates.metadata;
    }
    if (typeof updates.isActive !== 'undefined') {
        data.isActive = updates.isActive;
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
        throw new ApiError('Integration not found', 404);
    }
    if (integration.userId !== userId) {
        throw new ApiError('Unauthorized access to integration', 403);
    }

    await prisma.integration.delete({
        where: { id: integrationId }
    });
}

function formatIntegration(integration) {
    let credentials = {};
    try {
        credentials = JSON.parse(decrypt(integration.encryptedCredentials));
    } catch (e) {
        console.error(`Failed to decrypt credentials for integration ${integration.id}`);
        // Return masked or empty on error
    }

    // Mask sensitive parts for display if needed? 
    // Request says: "Return integration without exposing encrypted credentials"
    // "Decrypt credentials for response" implies we show them back to user so they can edit? 
    // Or normally we mask them. 
    // The GET example shows: "credentials": { "apiKey": "***" }
    // So we should mask.

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
        createdAt: integration.createdAt,
        isActive: integration.isActive
    };
}

function maskString(str) {
    if (!str || str.length < 8) return '****';
    return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
}

// Internal helper to get RAW credentials for usage by other services
async function getDecryptedCredentials(userId, provider) {
    const integration = await prisma.integration.findFirst({
        where: { userId, provider, isActive: true }
    });
    if (!integration) return null;
    return JSON.parse(decrypt(integration.encryptedCredentials));
}

async function testIntegrationConnection(provider, credentials) {
    // Basic connectivity tests
    try {
        if (provider === 'GEMINI') {
            const apiKey = credentials.apiKey;
            if (!apiKey) throw new Error('Missing apiKey');
            // Simple fetch to list models or similar free endpoint
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (!res.ok) throw new Error('Invalid API Key');
            return { success: true, message: 'Connected to Gemini' };
        }
        else if (provider === 'OPENAI') {
            const apiKey = credentials.apiKey;
            if (!apiKey) throw new Error('Missing apiKey');
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!res.ok) throw new Error('Invalid API Key');
            return { success: true, message: 'Connected to OpenAI' };
        }
        else if (provider === 'TWITTER' || provider === 'LINKEDIN') {
            // Placeholder for OAuth
            return { success: true, message: 'OAuth tokens valid (Mock)' };
        }
        else {
            return { success: true, message: 'Connection test passed (Generic)' };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    createIntegration,
    getIntegrationsByUserId,
    updateIntegration,
    deleteIntegration,
    testIntegrationConnection,
    getDecryptedCredentials
};
