// src/controllers/contentController.js
const prisma = require('../db/prismaClient');
const contentService = require('../services/contentService');
const ApiError = require('../utils/ApiError');

async function generateIdeas(req, res, next) {
    try {
        const { type, input } = req.body;
        const userId = req.user.userId;

        if (!type || !input) {
            throw new ApiError('Type and input are required', 400);
        }

        // Process Input
        const processedData = await contentService.processInput(type, input);

        // Create Session
        const session = await prisma.contentSession.create({
            data: {
                userId,
                inputType: type.toUpperCase(),
                inputPayload: { input, type }, // Store raw input
                status: 'IDEA',
            }
        });

        // Generate Ideas
        // This relies on having an integration.
        const ideas = await contentService.generateIdeasWithAI(userId, processedData);

        // Save Ideas
        const savedIdeas = [];
        for (const idea of ideas) {
            const savedIdea = await prisma.idea.create({
                data: {
                    sessionId: session.id,
                    title: idea.title,
                    description: idea.description
                }
            });
            savedIdeas.push({
                id: savedIdea.id,
                title: savedIdea.title,
                description: savedIdea.description
            });
        }

        res.json({ sessionId: session.id, ideas: savedIdeas });

    } catch (error) {
        next(error);
    }
}

async function generateQuestions(req, res, next) {
    try {
        const { ideaId } = req.body;
        const userId = req.user.userId;

        if (!ideaId) throw new ApiError('ideaId is required', 400);

        const idea = await prisma.idea.findUnique({
            where: { id: ideaId },
            include: { session: true }
        });

        if (!idea) throw new ApiError('Idea not found', 404);
        if (idea.session.userId !== userId) throw new ApiError('Unauthorized Access', 403);

        // Mark as selected
        await prisma.idea.update({
            where: { id: ideaId },
            data: { isSelected: true }
        });

        // Update Session
        await prisma.contentSession.update({
            where: { id: idea.session.id },
            data: {
                selectedIdeaId: ideaId,
                status: 'QNA'
            }
        });

        const questionsText = await contentService.generateQuestionsWithAI(userId, idea.title, idea.description);

        const savedQuestions = [];
        for (const qText of questionsText) {
            const savedQ = await prisma.question.create({
                data: {
                    sessionId: idea.session.id,
                    questionText: qText
                }
            });
            savedQuestions.push({ id: savedQ.id, questionText: savedQ.questionText });
        }

        res.json({ sessionId: idea.session.id, questions: savedQuestions });

    } catch (error) {
        next(error);
    }
}

async function generateDrafts(req, res, next) {
    try {
        const { sessionId, answers, platforms } = req.body; // answers: [{ questionId, answerText }]
        const userId = req.user.userId;

        const session = await prisma.contentSession.findUnique({
            where: { id: sessionId },
            include: { ideas: true, questions: true }
        });

        if (!session) throw new ApiError('Session not found', 404);
        if (session.userId !== userId) throw new ApiError('Unauthorized Access', 403);

        // Save Answers
        const answerMap = []; // To pass to AI
        for (const ans of answers) {
            // Verify question belongs to session? Optimized for speed -> trust ID if needed or strict check
            const q = session.questions.find(q => q.id === ans.questionId);
            if (q) {
                await prisma.answer.create({
                    data: {
                        questionId: ans.questionId,
                        answerText: ans.answerText
                    }
                });
                answerMap.push({ questionText: q.questionText, answerText: ans.answerText });
            }
        }

        // Update Status
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: { status: 'DRAFT' }
        });

        const selectedIdea = session.ideas.find(i => i.isSelected) || session.ideas[0]; // Fallback

        const contentVersions = [];
        for (const platform of platforms) {
            const contentBody = await contentService.generateContentForPlatform(userId, platform, selectedIdea.title, selectedIdea.description, answerMap);

            const cv = await prisma.contentVersion.create({
                data: {
                    sessionId: sessionId,
                    platform: platform,
                    body: contentBody,
                    status: 'DRAFT'
                }
            });
            contentVersions.push(cv);
        }

        res.json({ contentVersions });

    } catch (error) {
        next(error);
    }
}

async function getContentSessions(req, res, next) {
    try {
        const userId = req.user.userId;
        const { status, platform, search } = req.query;

        const filters = {};
        if (status) filters.status = status;
        if (platform) filters.platform = platform;
        if (search) filters.search = search;

        const sessions = await contentService.getSessionsByUserId(userId, filters);
        res.json({ sessions });
    } catch (error) {
        next(error);
    }
}

async function getSessionDetails(req, res, next) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const session = await contentService.getSessionWithDetails(id, userId);
        res.json(session);
    } catch (error) {
        next(error);
    }
}

async function updateContentVersion(req, res, next) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { body, metadata } = req.body;

        const updatedVersion = await contentService.updateContentVersionBody(id, userId, body, metadata);
        res.json(updatedVersion);
    } catch (error) {
        next(error);
    }
}

async function deleteSession(req, res, next) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        await contentService.deleteSessionCascade(id, userId);
        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        next(error);
    }
}

async function updateSessionStatus(req, res, next) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            throw new ApiError('Status is required', 400);
        }

        // Validate status
        const VALID_STATUSES = ['IDEA', 'QNA', 'DRAFT', 'READY', 'PUBLISHED'];
        if (!VALID_STATUSES.includes(status)) {
            throw new ApiError('Invalid status', 400);
        }

        // Get current session to validate transition
        const session = await contentService.getSessionWithDetails(id, userId);

        // Define status order for validation
        const statusOrder = { IDEA: 0, QNA: 1, DRAFT: 2, READY: 3, PUBLISHED: 4 };
        const currentOrder = statusOrder[session.status];
        const newOrder = statusOrder[status];

        // Allow moving forward or staying same, but not backwards
        if (newOrder < currentOrder) {
            throw new ApiError('Cannot move status backwards', 400);
        }

        // Update status
        const prisma = require('../db/prismaClient');
        const updated = await prisma.contentSession.update({
            where: { id },
            data: {
                status,
                updatedAt: new Date()
            },
            select: {
                id: true,
                status: true,
                updatedAt: true
            }
        });

        res.json(updated);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    generateIdeas,
    generateQuestions,
    generateDrafts,
    getContentSessions,
    getSessionDetails,
    updateContentVersion,
    deleteSession,
    updateSessionStatus
};