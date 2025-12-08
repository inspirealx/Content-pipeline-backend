// src/routes/contentRoutes.js
const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { generateIdeas, getQuestions, generateDrafts } = require('../controllers/contentController');

const router = express.Router();

router.use(authenticateToken);

router.post('/ideas', generateIdeas);
router.post('/questions', getQuestions);
router.post('/drafts', generateDrafts);

module.exports = router;