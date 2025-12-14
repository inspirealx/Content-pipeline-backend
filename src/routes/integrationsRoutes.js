// src/routes/integrationsRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
    createIntegration,
    getIntegrations,
    updateIntegration,
    deleteIntegration,
    testConnection
} = require('../controllers/integrationsController');

// All routes protected by auth
router.use(authenticateToken);

router.post('/', createIntegration);
router.get('/', getIntegrations);
router.patch('/:id', updateIntegration);
router.delete('/:id', deleteIntegration);
router.post('/test', testConnection);

module.exports = router;
