const { ElevenLabsClient } = require('elevenlabs');
const prisma = require('../db/prismaClient');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ElevenLabsService {
    constructor() {
        // Initialize with default key if available, but methods should accept dynamic keys
        this.defaultApiKey = process.env.ELEVENLABS_API_KEY;
    }

    getClient(apiKey) {
        return new ElevenLabsClient({
            apiKey: apiKey || this.defaultApiKey
        });
    }

    /**
     * Get available voices
     * @param {string} apiKey 
     * @returns {Promise<Array>} List of voices
     */
    async getVoices(apiKey) {
        const client = this.getClient(apiKey);
        try {
            const response = await client.voices.getAll();
            return response.voices.map(voice => ({
                voice_id: voice.voice_id,
                name: voice.name,
                preview_url: voice.preview_url,
                category: voice.category,
                labels: voice.labels
            }));
        } catch (error) {
            console.error('ElevenLabs getVoices error:', error);
            throw new Error(`Failed to fetch voices: ${error.message}`);
        }
    }

    /**
     * Generate audio from text
     * @param {string} text Script text
     * @param {string} voiceId Selected voice ID
     * @param {string} apiKey User's API key
     * @returns {Promise<Buffer>} Audio buffer
     */
    async generateAudio(text, voiceId, apiKey) {
        const client = this.getClient(apiKey);
        try {
            const audioStream = await client.textToSpeech.convert(voiceId, {
                text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            });

            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of audioStream) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        } catch (error) {
            console.error('ElevenLabs generateAudio error:', error);
            throw new Error(`Failed to generate audio: ${error.message}`);
        }
    }

    /**
     * Save audio file and create DB record
     * @param {Buffer} audioBuffer 
     * @param {string} userId 
     * @param {string} scriptId 
     * @param {object} metadata 
     */
    async saveAudio(audioBuffer, userId, scriptId, metadata) {
        // 1. Save to filesystem
        const fileName = `reel_${uuidv4()}.mp3`;
        const audioDir = path.join(__dirname, '../../public/generated-audio');

        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }

        const filePath = path.join(audioDir, fileName);
        fs.writeFileSync(filePath, audioBuffer);

        const audioUrl = `/generated-audio/${fileName}`;

        // 2. Create DB record
        const reelAudio = await prisma.reelAudio.create({
            data: {
                userId,
                scriptId,
                scriptText: metadata.text,
                voiceId: metadata.voiceId,
                audioUrl,
                status: 'SUCCESS',
                durationSeconds: 0 // Ideally calculate this
            }
        });

        return reelAudio;
    }
}

module.exports = new ElevenLabsService();
