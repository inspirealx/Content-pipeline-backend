// src/services/integrationService.js
const prisma = require('../db/prismaClient');
const { encrypt, decrypt } = require('../utils/encryption');

async function addIntegration(userId, provider, apiKey) {
    const encryptedKey = encrypt(apiKey);

    const integration = await prisma.integration.create({
        data: {
            userId,
            provider,
            credentialsEncrypted: encryptedKey,
        },
    });

    return integration;
}

async function getDecryptedKey(userId, provider) {
    const integration = await prisma.integration.findFirst({
        where: {
            userId,
            provider,
        },
    });

    if (!integration) {
        throw new Error('Integration not found');
    }

    return decrypt(integration.credentialsEncrypted);
}

async function getUserIntegrations(userId) {
    return await prisma.integration.findMany({
        where: { userId },
        select: {
            id: true,
            provider: true,
            createdAt: true,
            // Exclude credentialsEncrypted
        },
    });
}

module.exports = { addIntegration, getDecryptedKey, getUserIntegrations };