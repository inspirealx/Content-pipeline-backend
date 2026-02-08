// src/routes/integrationRequestRoutes.js
const express = require('express');
const router = express.Router();
const integrationRequestController = require('../controllers/integrationRequestController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Protect the route so only logged-in users can send requests
router.post('/', authenticateToken, integrationRequestController.createRequest);

module.exports = router;
