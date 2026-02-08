// src/controllers/contentController.js
const prisma = require('../db/prismaClient');
const contentService = require('../services/contentService');
const ApiError = require('../utils/ApiError');

/**
 * Generate a meaningful session title based on input type and content
 * @param {string} type - The input type (TOPIC, URL, KEYWORDS, FEED, TEXT)
 * @param {string|array} input - The input content
 * @returns {string} Generated title (max 100 chars)
 */
function generateSessionTitle(type, input) {
    const maxLength = 100;

    switch (type.toLowerCase()) {
        case 'topic':
            const topicTitle = typeof input === 'string'
                ? input.trim()
                : 'New Topic Session';
            return topicTitle.substring(0, maxLength);

        case 'urls':
        case 'url':
            try {
                const url = typeof input === 'string' ? input : (Array.isArray(input) ? input[0] : '');
                const urlObj = new URL(url);
                return `Content from ${urlObj.hostname}`.substring(0, maxLength);
            } catch {
                return 'URL Content Session';
            }

        case 'keywords':
            if (Array.isArray(input) && input.length > 0) {
                const keywordStr = input.slice(0, 3).join(', ');
                return `Keywords: ${keywordStr}`.substring(0, maxLength);
            } else if (typeof input === 'string') {
                return `Keywords: ${input}`.substring(0, maxLength);
            }
            return 'Keyword Content Session';

        case 'feed':
            try {
                const url = typeof input === 'string' ? input : '';
                const urlObj = new URL(url);
                return `RSS: ${urlObj.hostname}`.substring(0, maxLength);
            } catch {
                return 'RSS Feed Content';
            }

        case 'text':
            const textTitle = typeof input === 'string'
                ? input.trim().split('\n')[0]
                : 'Text Content';
            return textTitle.substring(0, maxLength);

        default:
            return 'New Content Session';
    }
}

/**
 * Maps frontend platform names to Prisma Platform enum values
 * @param {string} platform - Frontend platform name (lowercase)
 * @returns {string} Prisma enum value (uppercase)
 */
function mapPlatformToEnum(platform) {
    const platformMap = {
        'article': 'ARTICLE',
        'twitter': 'TWITTER',
        'linkedin': 'LINKEDIN',
        'reel': 'REEL_SCRIPT',
        'reel_script': 'REEL_SCRIPT',
        'youtube': 'YT_SCRIPT',
        'yt_script': 'YT_SCRIPT',
        'podcast': 'PODCAST_SCRIPT',
        'podcast_script': 'PODCAST_SCRIPT',
        'other': 'OTHER'
    };

    const enumValue = platformMap[platform?.toLowerCase()];

    if (!enumValue) {
        throw new Error(
            `Invalid platform: ${platform}. Supported: ${Object.keys(platformMap).join(', ')}`
        );
    }

    return enumValue;
}

async function generateIdeas(req, res, next) {
    try {
        const { type, input } = req.body;
        const userId = req.user.userId;

        if (!type || !input) {
            throw new ApiError('Type and input are required', 400);
        }

        // Process Input
        const processedData = await contentService.processInput(type, input);

        // Create Session with generated title
        const session = await prisma.contentSession.create({
            data: {
                userId,
                inputType: type.toUpperCase(),
                inputPayload: { input, type }, // Store raw input
                status: 'IDEA',
                title: generateSessionTitle(type, input),
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

        // 🆕 ENHANCEMENT: Start background topic analysis (don't await)
        // This runs in parallel while user selects idea and answers questions
        if (type.toUpperCase() === 'TOPIC') {
            const topic = typeof input === 'string' ? input : input.toString();
            console.log(`[ContentController] Starting background analysis for session ${session.id}`);

            performTopicAnalysisForExistingSession(session.id, topic, userId).catch(error => {
                console.error(`[ContentController] Background analysis failed for session ${session.id}:`, error);
                // Don't fail the request - analysis is enhancement only
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
                        sessionId,
                        questionId: ans.questionId,
                        answerText: ans.answerText
                    }
                });
                answerMap.push({ questionText: q.questionText, answerText: ans.answerText });
            }
        }

        //Update Status to DRAFTS
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: { status: 'DRAFT' }
        });

        const selectedIdea = session.ideas.find(i => i.isSelected) || session.ideas[0]; // Fallback

        // 🆕 ENHANCEMENT: Check if analysis data is available
        const hasAnalysis = session.metadata?.enrichmentComplete === true;
        const brief = session.metadata?.brief;

        console.log(`[ContentController] Generating drafts for session ${sessionId} | Analysis available: ${hasAnalysis}`);

        const contentVersions = [];

        if (hasAnalysis && brief) {
            // 🎯 ENHANCED GENERATION: Use analysis + Q&A together
            console.log(`[ContentController] Using ENHANCED generation with analysis data`);

            for (const platform of platforms) {
                const platformEnum = mapPlatformToEnum(platform);

                // Use the new platform content service with analysis data
                let contentBody;

                // Format answers for platform service
                const userAnswers = answerMap.map(a => ({
                    question: a.questionText,
                    answer: a.answerText
                }));

                // Get user niche for personalization
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { niche: true }
                });
                const userNiche = user?.niche || null;

                // Generate platform-specific content using analysis data
                if (platform.toLowerCase() === 'linkedin') {
                    const content = await platformContentService.generateLinkedInContent(brief, userAnswers, userId, userNiche);
                    contentBody = JSON.stringify(content);
                } else if (platform.toLowerCase() === 'twitter') {
                    const content = await platformContentService.generateTwitterContent(brief, userAnswers, userId, userNiche);
                    contentBody = JSON.stringify(content);
                } else if (platform.toLowerCase() === 'article' || platform.toLowerCase() === 'blog') {
                    const content = await platformContentService.generateBlogContent(brief, userAnswers, userId, userNiche);
                    contentBody = JSON.stringify(content);
                } else if (platform.toLowerCase().includes('reel')) {
                    const content = await platformContentService.generateReelScript(brief, userAnswers, userId, userNiche);
                    contentBody = JSON.stringify(content);
                } else {
                    // Fallback to old method for other platforms
                    contentBody = await contentService.generateContentForPlatform(userId, platform, selectedIdea.title, selectedIdea.description, answerMap);
                }

                const cv = await prisma.contentVersion.create({
                    data: {
                        sessionId: sessionId,
                        platform: platformEnum,
                        body: contentBody,
                        status: 'DRAFT',
                        metadata: { enhancedWithAnalysis: true }
                    }
                });
                contentVersions.push(cv);
            }
        } else {
            // 📝 STANDARD GENERATION: Use old method (for backward compatibility)
            console.log(`[ContentController] Using STANDARD generation (no analysis data)`);

            for (const platform of platforms) {
                const platformEnum = mapPlatformToEnum(platform);
                const contentBody = await contentService.generateContentForPlatform(userId, platform, selectedIdea.title, selectedIdea.description, answerMap);

                const cv = await prisma.contentVersion.create({
                    data: {
                        sessionId: sessionId,
                        platform: platformEnum,
                        body: contentBody,
                        status: 'DRAFT'
                    }
                });
                contentVersions.push(cv);
            }
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

async function regenerateContent(req, res, next) {
    try {
        const userId = req.user.userId;
        const { versionId, action, tone, length, style } = req.body;

        if (!versionId || !action) {
            throw new ApiError('versionId and action are required', 400);
        }

        const updated = await contentService.regenerateContentVersion(userId, versionId, {
            action,
            tone,
            length,
            style
        });

        res.json({
            id: updated.id,
            sessionId: updated.sessionId,
            platform: updated.platform,
            body: updated.body,
            status: updated.status,
            metadata: updated.metadata
        });
    } catch (error) {
        next(error);
    }
}

async function autoFixViolation(req, res, next) {
    try {
        const userId = req.user.userId;
        const { versionId, violationType } = req.body;

        if (!versionId || !violationType) {
            throw new ApiError('versionId and violationType are required', 400);
        }

        const result = await contentService.autoFixContentViolation(userId, versionId, violationType);

        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function getSessionDrafts(req, res, next) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const sessionData = await contentService.getSessionWithDetails(id, userId);

        // Return just the content versions in a clean format
        const drafts = sessionData.contentVersions.map(cv => ({
            id: cv.id,
            platform: cv.platform,
            body: cv.body,
            status: cv.status,
            metadata: cv.metadata || {},
            createdAt: cv.createdAt,
            updatedAt: cv.updatedAt
        }));

        res.json({
            drafts,
            session: {
                id: sessionData.session.id,
                title: sessionData.session.title,
                status: sessionData.session.status
            }
        });
    } catch (error) {
        next(error);
    }
}

// ========== NEW WORKFLOW METHODS FOR TOPIC ANALYSIS ==========

const topicAnalysisService = require('../services/topicAnalysisService');
const platformContentService = require('../services/platformContentService');

/**
 * Create new content session with topic analysis
 * POST /api/content/sessions
 */
async function createSession(req, res, next) {
    try {
        const { topic, inputType = 'TOPIC' } = req.body;
        const userId = req.user.userId;

        if (!topic) {
            throw new ApiError('Topic is required', 400);
        }

        // Create session with ANALYZING status
        const session = await prisma.contentSession.create({
            data: {
                userId,
                title: generateSessionTitle(inputType, topic),
                inputType: inputType.toUpperCase(),
                inputPayload: { topic, inputType },
                status: 'ANALYZING'
            }
        });

        // Start background analysis (don't await)
        performTopicAnalysis(session.id, topic, userId).catch(error => {
            console.error(`[ContentController] Background analysis failed for session ${session.id}:`, error);
        });

        res.json({
            success: true,
            sessionId: session.id,
            status: 'ANALYZING',
            message: 'Topic analysis started. This may take 30-60 seconds.'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Background method: Perform topic analysis
 * @param {string} sessionId - Session ID
 * @param {string} topic - Topic to analyze
 * @param {string} userId - User ID
 */
async function performTopicAnalysis(sessionId, topic, userId) {
    try {
        console.log(`[ContentController] Starting analysis for session ${sessionId}`);

        // Run comprehensive analysis
        const analysisResult = await topicAnalysisService.analyzeTopicComprehensive(topic, userId);

        // Store brief and raw data in session metadata
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: {
                metadata: {
                    brief: analysisResult.brief,
                    rawAnalysis: analysisResult.rawData,
                    analyzedAt: analysisResult.analyzedAt
                },
                status: 'BRIEF_READY'
            }
        });

        console.log(`[ContentController] Analysis complete for session ${sessionId}. Generating questions...`);

        // Generate questions based on brief
        await generateQuestionsFromBrief(sessionId, analysisResult.brief, userId);

    } catch (error) {
        console.error(`[ContentController] Analysis error for session ${sessionId}:`, error);

        // Update session with error status
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: {
                status: 'FAILED',
                metadata: {
                    error: error.message,
                    failedAt: new Date().toISOString()
                }
            }
        });
    }
}

/**
 * Background method: Perform topic analysis for EXISTING idea-based session
 * Stores analysis in metadata WITHOUT changing session status or workflow
 * @param {string} sessionId - Session ID
 * @param {string} topic - Topic to analyze
 * @param {string} userId - User ID
 */
async function performTopicAnalysisForExistingSession(sessionId, topic, userId) {
    try {
        console.log(`[ContentController] Background analysis started for existing session ${sessionId}`);

        // Run comprehensive analysis (takes ~30-60 seconds)
        const analysisResult = await topicAnalysisService.analyzeTopicComprehensive(topic, userId);

        // Store ONLY the brief and raw data in session metadata
        // Do NOT change session status - this is just enrichment data
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: {
                metadata: {
                    brief: analysisResult.brief,
                    rawAnalysis: analysisResult.rawData,
                    analyzedAt: analysisResult.analyzedAt,
                    enrichmentComplete: true
                }
            }
        });

        console.log(`[ContentController] Background analysis complete for session ${sessionId}`);

    } catch (error) {
        console.error(`[ContentController] Background analysis error for session ${sessionId}:`, error);
        // Store error but don't throw - analysis is optional enhancement
        try {
            await prisma.contentSession.update({
                where: { id: sessionId },
                data: {
                    metadata: {
                        analysisError: error.message,
                        analysisFailedAt: new Date().toISOString()
                    }
                }
            });
        } catch (updateError) {
            console.error(`[ContentController] Failed to store analysis error:`, updateError);
        }
    }
}

/**
 * Background method: Generate questions from brief
 * @param {string} sessionId - Session ID
 * @param {object} brief - Content brief
 * @param {string} userId - User ID
 */
async function generateQuestionsFromBrief(sessionId, brief, userId) {
    try {
        // Use existing topic analysis service to call AI
        const topicAnalysisService = require('../services/topicAnalysisService');

        const prompt = `Based on this content brief, generate 5-7 targeted questions to gather insights from the user.

TOPIC: ${brief.topicOverview.title}
AUDIENCE: ${brief.audienceInsights.primaryAudience}
PAIN POINTS: ${brief.audienceInsights.painPoints.join(', ')}

Generate questions that will help create personalized content. Focus on:
- User's personal experience with the topic
- Specific examples or case studies they can share
- Their unique perspective or insights
- Target audience considerations

Return ONLY a JSON array (no markdown):
[
  {
    "question": "question text",
    "purpose": "why this question helps",
    "category": "experience|audience|insights|examples"
  }
]`;

        const response = await topicAnalysisService.callAI(userId, prompt);
        const questionsData = topicAnalysisService.extractJSON(response);

        // Create question records
        for (const qData of questionsData) {
            await prisma.question.create({
                data: {
                    sessionId,
                    questionText: qData.question,
                    category: qData.category || 'general',
                    metadata: {
                        purpose: qData.purpose
                    }
                }
            });
        }

        // Update session status to QNA
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: { status: 'QNA' }
        });

        console.log(`[ContentController] Questions generated for session ${sessionId}`);
    } catch (error) {
        console.error(`[ContentController] Question generation error:`, error);
        throw error;
    }
}

/**
 * Get session with brief and questions
 * GET /api/content/sessions/:id
 * Now handles BOTH old workflow (IDEA/QNA/DRAFT) and new workflow (ANALYZING/BRIEF_READY/QNA/GENERATING/READY)
 */
async function getSessionWithBrief(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const session = await prisma.contentSession.findUnique({
            where: { id },
            include: {
                ideas: true,
                questions: {
                    orderBy: { createdAt: 'asc' }
                },
                answers: {
                    include: {
                        question: true
                    }
                },
                contentVersions: {
                    where: { status: 'DRAFT' },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!session) {
            throw new ApiError('Session not found', 404);
        }

        if (session.userId !== userId) {
            throw new ApiError('Unauthorized access', 403);
        }

        // Check if this is a NEW workflow session (has metadata.brief) or OLD workflow (has ideas)
        const isNewWorkflow = session.metadata?.brief !== undefined;
        const isOldWorkflow = session.ideas && session.ideas.length > 0;

        if (isNewWorkflow) {
            // NEW WORKFLOW: Return with brief
            res.json({
                success: true,
                session: {
                    id: session.id,
                    title: session.title,
                    status: session.status,
                    createdAt: session.createdAt,
                    updatedAt: session.updatedAt
                },
                brief: session.metadata?.brief || null,
                questions: session.questions.map(q => ({
                    id: q.id,
                    questionText: q.questionText,
                    category: q.category,
                    purpose: q.metadata?.purpose
                })),
                answers: session.answers.map(a => ({
                    id: a.id,
                    questionId: a.questionId,
                    answerText: a.answerText
                })),
                contentVersions: session.contentVersions.length
            });
        } else {
            // OLD WORKFLOW: Return with ideas (for backward compatibility)
            const selectedIdea = session.ideas.find(idea => idea.isSelected) || session.ideas[0];

            res.json({
                session: {
                    id: session.id,
                    userId: session.userId,
                    inputType: session.inputType,
                    inputPayload: session.inputPayload,
                    status: session.status,
                    title: session.title,
                    selectedIdeaId: session.selectedIdeaId,
                    createdAt: session.createdAt,
                    updatedAt: session.updatedAt
                },
                ideas: session.ideas.map(idea => ({
                    id: idea.id,
                    title: idea.title,
                    description: idea.description,
                    isSelected: idea.isSelected
                })),
                questions: session.questions.map(q => ({
                    id: q.id,
                    questionText: q.questionText
                })),
                answers: session.answers.map(a => ({
                    id: a.id,
                    questionId: a.questionId,
                    answerText: a.answerText
                })),
                contentVersions: session.contentVersions.map(cv => ({
                    id: cv.id,
                    platform: cv.platform,
                    body: cv.body,
                    status: cv.status,
                    metadata: cv.metadata,
                    createdAt: cv.createdAt
                })),
                selectedIdea
            });
        }
    } catch (error) {
        next(error);
    }
}

/**
 * Get session status (for polling)
 * GET /api/content/sessions/:id/status
 */
async function getSessionStatus(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const session = await prisma.contentSession.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                updatedAt: true,
                metadata: true,
                userId: true
            }
        });

        if (!session) {
            throw new ApiError('Session not found', 404);
        }

        if (session.userId !== userId) {
            throw new ApiError('Unauthorized access', 403);
        }

        res.json({
            success: true,
            status: session.status,
            hasError: session.status === 'FAILED',
            error: session.metadata?.error || null,
            updatedAt: session.updatedAt
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Submit answers and trigger content generation
 * POST /api/content/sessions/:id/answers
 */
async function submitAnswers(req, res, next) {
    try {
        const { id: sessionId } = req.params;
        const { answers } = req.body; // Array of { questionId, answer }
        const userId = req.user.userId;

        if (!answers || !Array.isArray(answers)) {
            throw new ApiError('Answers array is required', 400);
        }

        // Verify session ownership
        const session = await prisma.contentSession.findUnique({
            where: { id: sessionId },
            include: {
                questions: true
            }
        });

        if (!session) {
            throw new ApiError('Session not found', 404);
        }

        if (session.userId !== userId) {
            throw new ApiError('Unauthorized access', 403);
        }

        // Create answer records
        for (const ans of answers) {
            const question = session.questions.find(q => q.id === ans.questionId);
            if (question) {
                await prisma.answer.create({
                    data: {
                        sessionId,
                        questionId: ans.questionId,
                        answerText: ans.answer
                    }
                });
            }
        }

        // Update session status to GENERATING
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: { status: 'GENERATING' }
        });

        // Start background content generation (don't await)
        generateAllPlatformContentAsync(sessionId, userId).catch(error => {
            console.error(`[ContentController] Background generation failed for session ${sessionId}:`, error);
        });

        res.json({
            success: true,
            message: 'Answers saved. Generating content for all platforms...'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Background method: Generate content for all platforms
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 */
async function generateAllPlatformContentAsync(sessionId, userId) {
    try {
        console.log(`[ContentController] Generating content for session ${sessionId}`);

        // Fetch session with brief and answers
        const session = await prisma.contentSession.findUnique({
            where: { id: sessionId },
            include: {
                questions: true,
                answers: {
                    include: {
                        question: true
                    }
                }
            }
        });

        const brief = session.metadata?.brief;
        if (!brief) {
            throw new Error('Brief not found in session metadata');
        }

        // Format user answers
        const userAnswers = session.answers.map(a => ({
            question: a.question.questionText,
            answer: a.answerText
        }));

        // Generate content for all platforms
        const allContent = await platformContentService.generateAllPlatformContent(
            brief,
            userAnswers,
            userId
        );

        // Create ContentVersion records for each platform
        const platforms = ['linkedin', 'twitter', 'blog', 'reelScript'];
        for (const platform of platforms) {
            const content = allContent[platform];
            if (content && !content.error) {
                const platformEnum = mapPlatformToEnum(platform === 'reelScript' ? 'reel' : platform);
                const metadata = platformContentService.getMetadata(platform, content);

                await prisma.contentVersion.create({
                    data: {
                        sessionId,
                        platform: platformEnum,
                        body: JSON.stringify(content),
                        metadata,
                        status: 'DRAFT'
                    }
                });
            }
        }

        // Update session status to READY
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: { status: 'READY' }
        });

        console.log(`[ContentController] Content generated successfully for session ${sessionId}`);
    } catch (error) {
        console.error(`[ContentController] Generation error:`, error);

        // Update session with error
        await prisma.contentSession.update({
            where: { id: sessionId },
            data: {
                status: 'FAILED',
                metadata: {
                    ...session.metadata,
                    error: error.message,
                    failedAt: new Date().toISOString()
                }
            }
        });
    }
}

/**
 * Get generated content for all platforms
 * GET /api/content/sessions/:id/content
 */
async function getGeneratedContent(req, res, next) {
    try {
        const { id: sessionId } = req.params;
        const userId = req.user.userId;

        const session = await prisma.contentSession.findUnique({
            where: { id: sessionId },
            include: {
                contentVersions: {
                    where: { status: 'DRAFT' },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!session) {
            throw new ApiError('Session not found', 404);
        }

        if (session.userId !== userId) {
            throw new ApiError('Unauthorized access', 403);
        }

        // Group content by platform
        const content = {};
        for (const cv of session.contentVersions) {
            const platformKey = cv.platform.toLowerCase().replace('_script', 'Script');
            try {
                content[platformKey] = JSON.parse(cv.body);
            } catch (e) {
                content[platformKey] = { text: cv.body }; // Fallback if not JSON
            }
        }

        res.json({
            success: true,
            sessionId: session.id,
            status: session.status,
            brief: session.metadata?.brief || null,
            content
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Regenerate content for specific platform
 * POST /api/content/sessions/:id/regenerate
 */
async function regeneratePlatformContent(req, res, next) {
    try {
        const { id: sessionId } = req.params;
        const { platform, modifications } = req.body;
        const userId = req.user.userId;

        if (!platform) {
            throw new ApiError('Platform is required', 400);
        }

        // Verify session ownership
        const session = await prisma.contentSession.findUnique({
            where: { id: sessionId },
            include: {
                questions: true,
                answers: {
                    include: {
                        question: true
                    }
                }
            }
        });

        if (!session) {
            throw new ApiError('Session not found', 404);
        }

        if (session.userId !== userId) {
            throw new ApiError('Unauthorized access', 403);
        }

        let brief = session.metadata?.brief;
        if (!brief) {
            throw new ApiError('Brief not found', 400);
        }

        // Apply modifications if provided
        if (modifications) {
            brief = { ...brief, ...modifications };
        }

        // Format user answers
        const userAnswers = session.answers.map(a => ({
            question: a.question.questionText,
            answer: a.answerText
        }));

        // Generate new content for this platform
        const platformService = platformContentService;
        let newContent;

        if (platform === 'linkedin') {
            const userNiche = (await platformService.getUserIntegration(userId)).niche;
            newContent = await platformService.generateLinkedInContent(brief, userAnswers, userId, userNiche);
        } else if (platform === 'twitter') {
            const userNiche = (await platformService.getUserIntegration(userId)).niche;
            newContent = await platformService.generateTwitterContent(brief, userAnswers, userId, userNiche);
        } else if (platform === 'blog') {
            const userNiche = (await platformService.getUserIntegration(userId)).niche;
            newContent = await platformService.generateBlogContent(brief, userAnswers, userId, userNiche);
        } else if (platform === 'reel' || platform === 'reelScript') {
            const userNiche = (await platformService.getUserIntegration(userId)).niche;
            newContent = await platformService.generateReelScript(brief, userAnswers, userId, userNiche);
        } else {
            throw new ApiError(`Unsupported platform: ${platform}`, 400);
        }

        // Create new content version
        const platformEnum = mapPlatformToEnum(platform === 'reelScript' ? 'reel' : platform);
        const metadata = platformService.getMetadata(platform, newContent);

        const contentVersion = await prisma.contentVersion.create({
            data: {
                sessionId,
                platform: platformEnum,
                body: JSON.stringify(newContent),
                metadata,
                status: 'DRAFT'
            }
        });

        res.json({
            success: true,
            content: newContent,
            version: {
                id: contentVersion.id,
                createdAt: contentVersion.createdAt
            }
        });
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
    updateSessionStatus,
    regenerateContent,
    autoFixViolation,
    getSessionDrafts,
    // New workflow methods
    createSession,
    getSessionWithBrief,
    getSessionStatus,
    submitAnswers,
    getGeneratedContent,
    regeneratePlatformContent
};