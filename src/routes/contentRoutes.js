// src/routes/contentRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
    generateIdeas,
    generateQuestions,
    generateDrafts,
    getContentSessions,
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
} = require('../controllers/contentController');

router.use(authenticateToken);

// NEW WORKFLOW: Topic Analysis & Platform Content Generation
router.post('/sessions', createSession); // Create session with topic analysis
router.get('/sessions/:id', getSessionWithBrief); // Get session with brief
router.get('/sessions/:id/status', getSessionStatus); // Poll status
router.post('/sessions/:id/answers', submitAnswers); // Submit answers
router.get('/sessions/:id/content', getGeneratedContent); // Get generated content
router.post('/sessions/:id/regenerate', regeneratePlatformContent); // Regenerate platform

// EXISTING WORKFLOW: Idea-based generation
router.post('/ideas', generateIdeas);
router.post('/questions', generateQuestions);
router.post('/drafts', generateDrafts);

// Content management endpoints
router.get('/sessions', getContentSessions);
router.get('/sessions/:id/drafts', getSessionDrafts);
router.patch('/versions/:id', updateContentVersion);
router.delete('/sessions/:id', deleteSession);
router.patch('/sessions/:id/status', updateSessionStatus);

// Content modification endpoints
router.post('/regenerate', regenerateContent);
router.post('/auto-fix', autoFixViolation);

module.exports = router;