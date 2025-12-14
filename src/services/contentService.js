// src/services/contentService.js
const scraperService = require('./scraperService');
const aiService = require('./aiService');
const integrationsService = require('./integrationsService');
const ApiError = require('../utils/ApiError');

async function processInput(type, input) {
    if (type === 'url') {
        return await scraperService.scrapeURL(input);
    } else if (type === 'topic') {
        return { title: input, content: input, description: input };
    } else if (type === 'keywords') {
        return { title: input, content: input, description: input }; // Or join ? "Topic: " + input
    } else if (type === 'feed') {
        const items = await scraperService.parseRSSFeed(input);
        // Combine items into a summary? Or return list?
        // Prompt expects string input.
        // Let's combine titles of first 5 items.
        const combined = items.map(i => `${i.title}: ${i.description}`).join('\n\n');
        return { title: 'RSS Feed Summary', content: combined };
    }
    throw new ApiError('Invalid input type', 400);
}

async function generateIdeasWithAI(userId, inputData) {
    // Get Credentials (prefer Gemini for now or generic)
    // We need logic to decide which provider to use. 
    // Assumption: User must have ONE valid integration. 
    // Let's try to find Gemini first, then OpenAI.

    let apiKey, provider;
    try {
        const creds = await integrationsService.getDecryptedCredentials(userId, 'GEMINI');
        if (creds) {
            apiKey = creds.apiKey;
            provider = 'GEMINI';
        } else {
            const credsOpenAI = await integrationsService.getDecryptedCredentials(userId, 'OPENAI');
            if (credsOpenAI) {
                apiKey = credsOpenAI.apiKey;
                provider = 'OPENAI';
            }
        }
    } catch (e) {
        console.warn('Error fetching credentials', e);
    }

    if (!apiKey) {
        throw new ApiError('No active AI integration found (Gemini or OpenAI). Please configure integrations.', 400);
    }

    const prompt = `Generate 3 unique content ideas based on: ${inputData.title} - ${inputData.content}. 
     For each idea provide: title and description.
     Return ONLY a valid JSON array: [{ "title": "...", "description": "..." }]`;

    let responseText;
    if (provider === 'GEMINI') {
        responseText = await aiService.callGeminiAPI(prompt, apiKey);
    } else {
        responseText = await aiService.callOpenAIAPI(prompt, apiKey);
    }

    // Cleanup JSON
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        return JSON.parse(responseText);
    } catch (e) {
        console.error('AI Response parse error:', responseText);
        throw new ApiError('Failed to parse AI response', 500);
    }
}

async function generateQuestionsWithAI(userId, ideaTitle, ideaDescription) {
    let apiKey, provider;
    const creds = await integrationsService.getDecryptedCredentials(userId, 'GEMINI');
    if (creds) { apiKey = creds.apiKey; provider = 'GEMINI'; }
    else {
        const o = await integrationsService.getDecryptedCredentials(userId, 'OPENAI');
        if (o) { apiKey = o.apiKey; provider = 'OPENAI'; }
    }

    if (!apiKey) throw new ApiError('No active AI integration found', 400);

    const prompt = `Based on this content idea: ${ideaTitle} - ${ideaDescription}
     Generate 5 clarifying questions to refine the content.
     Questions should help gather more details, target audience, tone, etc.
     Return ONLY a valid JSON array of strings: ["question1", "question2", ...]`;

    let responseText;
    if (provider === 'GEMINI') responseText = await aiService.callGeminiAPI(prompt, apiKey);
    else responseText = await aiService.callOpenAIAPI(prompt, apiKey);

    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(responseText);
    } catch (e) {
        throw new ApiError('Failed to parse AI response', 500);
    }
}

async function generateContentForPlatform(userId, platform, ideaTitle, ideaDescription, answers) {
    let apiKey, provider;
    const creds = await integrationsService.getDecryptedCredentials(userId, 'GEMINI');
    if (creds) { apiKey = creds.apiKey; provider = 'GEMINI'; }
    else {
        const o = await integrationsService.getDecryptedCredentials(userId, 'OPENAI');
        if (o) { apiKey = o.apiKey; provider = 'OPENAI'; }
    }

    if (!apiKey) throw new ApiError('No active AI integration found', 400);

    const answersText = answers.map(a => `Q: ${a.questionText || 'Unknown'}\nA: ${a.answerText}`).join('\n\n');

    let platformPrompt = '';
    switch (platform) {
        case 'ARTICLE': platformPrompt = 'Write a 800-word blog article'; break;
        case 'TWITTER': platformPrompt = 'Write a Twitter thread (max 5 tweets, 280 chars each)'; break;
        case 'LINKEDIN': platformPrompt = 'Write a LinkedIn post (max 3000 chars)'; break;
        case 'REEL_SCRIPT': platformPrompt = 'Write a 30-60 second reel script'; break;
        default: platformPrompt = `Write content for ${platform}`;
    }

    const prompt = `Context:
    Idea: ${ideaTitle} - ${ideaDescription}
    
    Refinement Questions & Answers:
    ${answersText}
    
    Task:
    ${platformPrompt}.
    Return only the content text.`;

    if (provider === 'GEMINI') return await aiService.callGeminiAPI(prompt, apiKey);
    else return await aiService.callOpenAIAPI(prompt, apiKey);
}

async function getSessionsByUserId(userId, filters = {}) {
    const where = { userId };

    if (filters.status) {
        where.status = filters.status;
    }

    // Platform filter requires joining through contentVersions
    if (filters.platform) {
        where.contentVersions = {
            some: {
                platform: filters.platform
            }
        };
    }

    // Search in inputPayload or we could add a title field to session
    // For now, searching in inputPayload.input
    if (filters.search) {
        where.OR = [
            {
                inputPayload: {
                    path: ['input'],
                    string_contains: filters.search
                }
            }
        ];
    }

    const prisma = require('../db/prismaClient');
    const sessions = await prisma.contentSession.findMany({
        where,
        include: {
            _count: {
                select: {
                    ideas: true,
                    contentVersions: true
                }
            },
            ideas: {
                where: { isSelected: true },
                select: { title: true }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    // Format response to include title from selected idea or input
    return sessions.map(session => ({
        id: session.id,
        title: session.ideas[0]?.title || session.inputPayload?.input || 'Untitled',
        status: session.status,
        inputType: session.inputType,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        _count: session._count
    }));
}

async function getSessionWithDetails(sessionId, userId) {
    const prisma = require('../db/prismaClient');

    const session = await prisma.contentSession.findUnique({
        where: { id: sessionId },
        include: {
            ideas: true,
            questions: {
                include: {
                    answers: true
                }
            },
            contentVersions: {
                orderBy: {
                    createdAt: 'desc'
                }
            }
        }
    });

    if (!session) {
        throw new ApiError('Session not found', 404);
    }

    if (session.userId !== userId) {
        throw new ApiError('Unauthorized access to session', 403);
    }

    // Find selected idea
    const selectedIdea = session.ideas.find(i => i.isSelected) || null;

    return {
        id: session.id,
        title: selectedIdea?.title || session.inputPayload?.input || 'Untitled',
        status: session.status,
        inputType: session.inputType,
        inputPayload: session.inputPayload,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        selectedIdea,
        ideas: session.ideas,
        questions: session.questions,
        contentVersions: session.contentVersions
    };
}

async function updateContentVersionBody(versionId, userId, body, metadata) {
    const prisma = require('../db/prismaClient');

    // Find version and verify ownership through session
    const version = await prisma.contentVersion.findUnique({
        where: { id: versionId },
        include: {
            session: true
        }
    });

    if (!version) {
        throw new ApiError('Content version not found', 404);
    }

    if (version.session.userId !== userId) {
        throw new ApiError('Unauthorized access to content version', 403);
    }

    // Build update data
    const updateData = {};
    if (body !== undefined) updateData.body = body;
    if (metadata !== undefined) updateData.metadata = metadata;
    updateData.updatedAt = new Date();

    // Update version and session timestamp
    const [updatedVersion] = await prisma.$transaction([
        prisma.contentVersion.update({
            where: { id: versionId },
            data: updateData
        }),
        prisma.contentSession.update({
            where: { id: version.sessionId },
            data: { updatedAt: new Date() }
        })
    ]);

    return updatedVersion;
}

async function deleteSessionCascade(sessionId, userId) {
    const prisma = require('../db/prismaClient');

    // Verify ownership
    const session = await prisma.contentSession.findUnique({
        where: { id: sessionId },
        select: { userId: true }
    });

    if (!session) {
        throw new ApiError('Session not found', 404);
    }

    if (session.userId !== userId) {
        throw new ApiError('Unauthorized access to session', 403);
    }

    // Delete in transaction for atomicity
    // Prisma should handle cascade deletes if configured in schema,
    // but we'll be explicit for safety
    await prisma.$transaction(async (tx) => {
        // Delete answers (through questions)
        await tx.answer.deleteMany({
            where: {
                question: {
                    sessionId
                }
            }
        });

        // Delete questions
        await tx.question.deleteMany({
            where: { sessionId }
        });

        // Delete content versions
        await tx.contentVersion.deleteMany({
            where: { sessionId }
        });

        // Delete ideas
        await tx.idea.deleteMany({
            where: { sessionId }
        });

        // Delete session
        await tx.contentSession.delete({
            where: { id: sessionId }
        });
    });
}

module.exports = {
    processInput,
    generateIdeasWithAI,
    generateQuestionsWithAI,
    generateContentForPlatform,
    getSessionsByUserId,
    getSessionWithDetails,
    updateContentVersionBody,
    deleteSessionCascade
};
