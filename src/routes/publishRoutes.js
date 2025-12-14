// src/routes/publishRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
    publishContent,
    getPublishQueue,
    retryPublish,
    generateVideo,
    getVideoQueue
} = require('../controllers/publishController');

router.use(authenticateToken);

// Publishing endpoints
router.post('/publish', publishContent);
router.get('/queue', getPublishQueue);
router.post('/retry/:jobId', retryPublish);

// Video generation endpoints
router.post('/video', generateVideo);
router.get('/video/queue', getVideoQueue);

module.exports = router;
