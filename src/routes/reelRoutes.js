const express = require('express');
const router = express.Router();
const elevenLabsService = require('../services/elevenLabsService');
const { authenticateToken } = require('../middleware/authMiddleware');
const prisma = require('../db/prismaClient'); // Assuming this path

const { decrypt } = require('../utils/encryption');

// Helper to get API key (user's custom or system default)
const getApiKey = async (userId) => {
    // Check if user has their own key in Integration table
    const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'ELEVENLABS' }
    });

    if (integration && integration.credentialsEncrypted) {
        try {
            const credentials = JSON.parse(decrypt(integration.credentialsEncrypted));
            if (credentials.apiKey) {
                return credentials.apiKey;
            }
        } catch (error) {
            console.error('Failed to decrypt ElevenLabs credentials:', error);
        }
    }
    return process.env.ELEVENLABS_API_KEY;
};

// GET /api/reels/voices
router.get('/voices', authenticateToken, async (req, res) => {
    try {
        const apiKey = await getApiKey(req.userId);
        if (!apiKey) {
            return res.status(400).json({ error: 'ElevenLabs API key not configured' });
        }
        const voices = await elevenLabsService.getVoices(apiKey);
        res.json({ voices });
    } catch (error) {
        console.error('Error in GET /reels/voices:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/reels/generate-audio
router.post('/generate-audio', authenticateToken, async (req, res) => {
    const { scriptText, voiceId, scriptId } = req.body;

    if (!scriptText || !voiceId) {
        return res.status(400).json({ error: 'scriptText and voiceId are required' });
    }

    try {
        const apiKey = await getApiKey(req.userId);
        if (!apiKey) {
            return res.status(400).json({ error: 'ElevenLabs API key not configured' });
        }

        // 1. Generate Audio
        const audioBuffer = await elevenLabsService.generateAudio(scriptText, voiceId, apiKey);

        // 2. Save File & DB Record
        const reelAudio = await elevenLabsService.saveAudio(audioBuffer, req.userId, scriptId, {
            text: scriptText,
            voiceId: voiceId
        });

        res.json({ success: true, audio: reelAudio });

    } catch (error) {
        console.error('Audio generation failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/reels/audio/:id
router.get('/audio/:id', authenticateToken, async (req, res) => {
    try {
        const audio = await prisma.reelAudio.findFirst({
            where: { id: req.params.id, userId: req.userId }
        });

        if (!audio) {
            return res.status(404).json({ error: 'Audio not found' });
        }

        res.json(audio);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
