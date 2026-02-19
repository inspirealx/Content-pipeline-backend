// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const contentRoutes = require('./contentRoutes');
const integrationsRoutes = require('./integrationsRoutes');
const integrationRequestRoutes = require('./integrationRequestRoutes');
const publishRoutes = require('./publishRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const userRoutes = require('./userRoutes');
const reelRoutes = require('./reelRoutes');
const adminRoutes = require('./adminRoutes');
const integrationStatusRoutes = require('./integrationRoutes');
const miscRoutes = require('./miscRoutes');

router.use('/auth', authRoutes);
router.use('/integrations', integrationStatusRoutes); // Check status first
router.use('/integrations', integrationsRoutes);
router.use('/integration-requests', integrationRequestRoutes);
router.use('/content', contentRoutes);
router.use('/publish', publishRoutes);
router.use('/reels', reelRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/', miscRoutes);

module.exports = router;