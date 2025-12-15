// src/routes/contentRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
    generateIdeas,
    generateQuestions,
    generateDrafts,
    getContentSessions,
    getSessionDetails,
    updateContentVersion,
    deleteSession,
    updateSessionStatus,
    regenerateContent,
    autoFixViolation
} = require('../controllers/contentController');

router.use(authenticateToken);

// Content generation endpoints
router.post('/ideas', generateIdeas);
router.post('/questions', generateQuestions);
router.post('/drafts', generateDrafts);

// Content management endpoints
router.get('/sessions', getContentSessions);
router.get('/sessions/:id', getSessionDetails);
router.patch('/versions/:id', updateContentVersion);
router.delete('/sessions/:id', deleteSession);
router.patch('/sessions/:id/status', updateSessionStatus);

// Content modification endpoints
router.post('/regenerate', regenerateContent);
router.post('/auto-fix', autoFixViolation);

module.exports = router;