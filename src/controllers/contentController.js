// src/controllers/contentController.js
const prisma = require('../db/prismaClient');
const scraperService = require('../services/scraperService');
const integrationService = require('../services/integrationService');
const aiService = require('../services/aiService');

async function generateIdeas(req, res, next) {
    try {
        const { type, input } = req.body; // type: 'url' or 'topic', input: url or topic text
        const userId = req.user.userId;

        let processedInput = input;
        if (type === 'url') {
            const scraped = await scraperService.scrapeUrl(input);
            processedInput = `Title: ${scraped.title}\nContent: ${scraped.body}`;
        }

        // Get Gemini API key
        const geminiKey = await integrationService.getDecryptedKey(userId, 'GEMINI');

        // Generate ideas
        const ideas = await aiService.generateContentIdeas(processedInput, geminiKey);

        // Create ContentSession
        const session = await prisma.contentSession.create({
            data: {
                userId,
                inputType: type.toUpperCase(),
                inputPayload: { input },
                status: 'IDEA',
            },
        });

        // Save ideas
        const savedIdeas = [];
        for (const idea of ideas) {
            const savedIdea = await prisma.idea.create({
                data: {
                    sessionId: session.id,
                    title: idea.title,
                    description: idea.description,
                },
            });
            savedIdeas.push(savedIdea);
        }

        res.json({ sessionId: session.id, ideas: savedIdeas });
    } catch (error) {
        next(error);
    }
}

async function getQuestions(req, res, next) {
    try {
        const { ideaId } = req.body;
        const userId = req.user.userId;

        // Fetch the Idea and its Session
        const idea = await prisma.idea.findUnique({
            where: { id: ideaId },
            include: { session: true },
        });

        if (!idea || idea.session.userId !== userId) {
            return res.status(404).json({ message: 'Idea not found' });
        }

        // Update Session status
        await prisma.contentSession.update({
            where: { id: idea.session.id },
            data: { status: 'QNA' },
        });

        // Get Gemini key
        const geminiKey = await integrationService.getDecryptedKey(userId, 'GEMINI');

        // Generate questions
        const questions = await aiService.generateQuestions(`${idea.title}: ${idea.description}`, geminiKey);

        // Save questions
        const savedQuestions = [];
        for (const qText of questions) {
            const savedQ = await prisma.question.create({
                data: {
                    sessionId: idea.session.id,
                    questionText: qText,
                },
            });
            savedQuestions.push(savedQ);
        }

        res.json({ questions: savedQuestions });
    } catch (error) {
        next(error);
    }
}

async function generateDrafts(req, res, next) {
    try {
        const { sessionId, answers, platforms } = req.body;
        const userId = req.user.userId;

        // Validate session belongs to user
        const session = await prisma.contentSession.findUnique({
            where: { id: sessionId },
            include: { ideas: true, questions: true },
        });

        if (!session || session.userId !== userId) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Save answers
        for (const ans of answers) {
            await prisma.answer.create({
                data: {
                    questionId: ans.questionId,
                    answerText: ans.answerText,
                },
            });
        }

        // Fetch full context
        const selectedIdea = session.ideas.find(i => i.isSelected) || session.ideas[0]; // Assume first or selected
        const context = {
            idea: { title: selectedIdea.title, description: selectedIdea.description },
            questions: session.questions.map(q => q.questionText),
            answers: answers.map(a => a.answerText),
        };

        // Get Gemini key
        const geminiKey = await integrationService.getDecryptedKey(userId, 'GEMINI');

        // Generate final content
        const contentMap = await aiService.generateFinalContent(context, platforms, geminiKey);

        // Save to ContentVersion
        const savedVersions = [];
        for (const [platform, body] of Object.entries(contentMap)) {
            const version = await prisma.contentVersion.create({
                data: {
                    sessionId,
                    platform: platform.toUpperCase(),
                    body,
                    status: 'DRAFT',
                },
            });
            savedVersions.push(version);
        }

        // Update session status
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: { status: 'DRAFT' },
        });

        res.json({ contentVersions: savedVersions });
    } catch (error) {
        next(error);
    }
}

module.exports = { generateIdeas, getQuestions, generateDrafts };