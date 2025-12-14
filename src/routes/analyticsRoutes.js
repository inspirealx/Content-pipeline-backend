// src/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getDashboardStats,
  getContentPerformance,
  getPublishingAnalytics,
  getIntegrationHealth
} = require('../controllers/analyticsController');

router.use(authenticateToken);

router.get('/dashboard', getDashboardStats);
router.get('/content-performance', getContentPerformance);
router.get('/publishing', getPublishingAnalytics);
router.get('/integration-health', getIntegrationHealth);

module.exports = router;
