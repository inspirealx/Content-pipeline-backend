// src/services/videoService.js
const fetch = require('node-fetch');
const prisma = require('../db/prismaClient');
const integrationsService = require('./integrationsService');
const ApiError = require('../utils/ApiError');

async function generateWithElevenLabs(script, voiceId, apiKey) {
    if (!voiceId || !apiKey) {
        throw new ApiError('ElevenLabs credentials incomplete', 400);
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        },
        body: JSON.stringify({
            text: script,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API Error: ${error}`);
    }

    // In production, save the audio buffer to cloud storage (S3, etc.)
    // For now, we'll save to local filesystem
    const audioBuffer = await response.buffer();

    // Save to public/generated-audio directory
    const fs = require('fs');
    const path = require('path');

    const audioDir = path.join(__dirname, '../../public/generated-audio');
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    }

    const filename = `elevenlabs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
    const filepath = path.join(audioDir, filename);

    fs.writeFileSync(filepath, audioBuffer);

    // Return URL accessible via static file serving
    const assetUrl = `/generated-audio/${filename}`;

    return {
        assetUrl,
        provider: 'ELEVENLABS',
        status: 'COMPLETED'
    };
}

async function generateWithHeyGen(script, avatarId, apiKey, voiceId = null) {
    if (!avatarId || !apiKey) {
        throw new ApiError('HeyGen credentials incomplete', 400);
    }

    const videoInput = {
        character: {
            type: 'avatar',
            avatar_id: avatarId
        },
        voice: {
            type: 'text',
            input_text: script
        }
    };

    if (voiceId) {
        videoInput.voice.voice_id = voiceId;
    }

    const response = await fetch('https://api.heygen.com/v1/video.generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey
        },
        body: JSON.stringify({
            video_inputs: [videoInput],
            dimension: {
                width: 1920,
                height: 1080
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`HeyGen API Error: ${error}`);
    }

    const data = await response.json();

    // HeyGen returns a video_id that needs to be polled for completion
    return {
        videoId: data.data.video_id,
        status: 'PROCESSING',
        provider: 'HEYGEN'
    };
}

async function pollHeyGenStatus(videoId, apiKey) {
    const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        method: 'GET',
        headers: {
            'X-Api-Key': apiKey
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`HeyGen Status API Error: ${error}`);
    }

    const data = await response.json();

    return {
        status: data.data.status, // 'pending', 'processing', 'completed', 'failed'
        videoUrl: data.data.video_url,
        error: data.data.error
    };
}

async function createVideoJob(userId, versionId, provider, params) {
    // Verify content version belongs to user and is a script type
    const version = await prisma.contentVersion.findUnique({
        where: { id: versionId },
        include: {
            session: true
        }
    });

    if (!version) {
        throw new ApiError('Content version not found', 404);
    }

    if (version.session.userId !== userId) {
        throw new ApiError('Unauthorized access to content version', 403);
    }

    // Ideally check if platform is REEL_SCRIPT or similar
    // For now, we'll allow any content

    // Get user's integration for provider
    const credentials = await integrationsService.getDecryptedCredentials(userId, provider);

    if (!credentials) {
        throw new ApiError(`No active ${provider} integration found`, 400);
    }

    // Create video job
    const job = await prisma.videoJob.create({
        data: {
            contentVersionId: versionId,
            provider: provider,
            status: 'PENDING',
            params: params
        }
    });

    // Execute video generation in background
    executeVideoGeneration(job.id, version.body, provider, params, credentials).catch(err => {
        console.error(`Failed to execute video job ${job.id}:`, err);
    });

    return job;
}

async function executeVideoGeneration(jobId, script, provider, params, credentials) {
    // Update status to RUNNING
    await prisma.videoJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date() }
    });

    try {
        let result;

        if (provider === 'ELEVENLABS') {
            const voiceId = params.voiceId || credentials.defaultVoiceId;
            result = await generateWithElevenLabs(script, voiceId, credentials.apiKey);

            // Update job with success
            await prisma.videoJob.update({
                where: { id: jobId },
                data: {
                    status: 'COMPLETED',
                    remoteAssetUrl: result.assetUrl,
                    completedAt: new Date()
                }
            });

        } else if (provider === 'HEYGEN') {
            const avatarId = params.avatarId;
            const voiceId = params.voiceId || null;
            result = await generateWithHeyGen(script, avatarId, credentials.apiKey, voiceId);

            // Update job with processing status
            await prisma.videoJob.update({
                where: { id: jobId },
                data: {
                    status: 'PROCESSING',
                    remoteId: result.videoId
                }
            });

            // Poll for completion (in production, use webhooks)
            pollHeyGenCompletion(jobId, result.videoId, credentials.apiKey);

        } else {
            throw new Error(`Unsupported video provider: ${provider}`);
        }

    } catch (error) {
        // Update job with failure
        await prisma.videoJob.update({
            where: { id: jobId },
            data: {
                status: 'FAILED',
                log: {
                    error: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                },
                completedAt: new Date()
            }
        });

        throw error;
    }
}

async function pollHeyGenCompletion(jobId, videoId, apiKey) {
    const maxAttempts = 60; // Poll for up to 10 minutes (every 10 seconds)
    let attempts = 0;

    const poll = async () => {
        try {
            const status = await pollHeyGenStatus(videoId, apiKey);

            if (status.status === 'completed') {
                await prisma.videoJob.update({
                    where: { id: jobId },
                    data: {
                        status: 'COMPLETED',
                        remoteAssetUrl: status.videoUrl,
                        completedAt: new Date()
                    }
                });
            } else if (status.status === 'failed') {
                await prisma.videoJob.update({
                    where: { id: jobId },
                    data: {
                        status: 'FAILED',
                        log: { error: status.error },
                        completedAt: new Date()
                    }
                });
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(poll, 10000); // Poll every 10 seconds
            } else {
                // Timeout
                await prisma.videoJob.update({
                    where: { id: jobId },
                    data: {
                        status: 'FAILED',
                        log: { error: 'Polling timeout' },
                        completedAt: new Date()
                    }
                });
            }
        } catch (error) {
            console.error(`Error polling HeyGen status for job ${jobId}:`, error);
        }
    };

    // Start polling after 10 seconds
    setTimeout(poll, 10000);
}

async function getVideoJobs(userId, filters = {}) {
    const where = {
        contentVersion: {
            session: {
                userId
            }
        }
    };

    if (filters.status) {
        where.status = filters.status;
    }

    const jobs = await prisma.videoJob.findMany({
        where,
        include: {
            contentVersion: {
                select: {
                    platform: true,
                    body: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return jobs;
}

module.exports = {
    generateWithElevenLabs,
    generateWithHeyGen,
    createVideoJob,
    getVideoJobs,
    pollHeyGenStatus
};
