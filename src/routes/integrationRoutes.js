// src/routes/integrationRoutes.js
const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { addIntegration, getIntegrations } = require('../controllers/integrationController');

const router = express.Router();

router.use(authenticateToken);

router.post('/', addIntegration);
router.get('/', getIntegrations);

module.exports = router;