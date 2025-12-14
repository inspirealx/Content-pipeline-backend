// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const contentRoutes = require('./contentRoutes');
const integrationsRoutes = require('./integrationsRoutes');
const publishRoutes = require('./publishRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const userRoutes = require('./userRoutes');

router.use('/auth', authRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/content', contentRoutes);
router.use('/publish', publishRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/users', userRoutes);

module.exports = router;