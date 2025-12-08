// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const integrationRoutes = require('./integrationRoutes');
const contentRoutes = require('./contentRoutes');

router.use('/auth', authRoutes);
router.use('/integrations', integrationRoutes);
router.use('/content', contentRoutes);

module.exports = router;