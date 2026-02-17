// src/services/publishService.js
const fetch = require('node-fetch');
const prisma = require('../db/prismaClient');
const integrationsService = require('./integrationsService');
const ApiError = require('../utils/ApiError');
const { broadcastPublishUpdate } = require('./websocketService');

async function publishToWordPress(content, credentials, metadata = {}) {
    const { siteUrl, username, appPassword } = credentials;

    if (!siteUrl || !username || !appPassword) {
        throw new ApiError('WordPress credentials incomplete', 400);
    }

    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

    const body = {
        title: metadata.title || 'Untitled',
        content: content,
        status: metadata.status || 'publish', // 'publish' or 'draft'
    };

    if (metadata.categories) body.categories = metadata.categories;
    if (metadata.tags) body.tags = metadata.tags;

    const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`WordPress API Error: ${error}`);
    }

    const data = await response.json();
    return {
        remoteId: data.id.toString(),
        remoteUrl: data.link
    };
}

async function publishToTwitter(content, credentials) {
    const { accessToken, accessTokenSecret, consumerKey, consumerSecret } = credentials;

    if (!accessToken) {
        throw new ApiError('Twitter credentials incomplete', 400);
    }

    // Split into thread if content > 280 chars
    const tweets = splitIntoTweets(content);
    const tweetIds = [];
    let previousTweetId = null;

    for (const tweetText of tweets) {
        const body = {
            text: tweetText
        };

        if (previousTweetId) {
            body.reply = {
                in_reply_to_tweet_id: previousTweetId
            };
        }

        // Using OAuth 2.0 Bearer Token (simpler for this example)
        const response = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Twitter API Error: ${error}`);
        }

        const data = await response.json();
        previousTweetId = data.data.id;
        tweetIds.push(previousTweetId);
    }

    return {
        remoteId: tweetIds[0],
        remoteUrl: `https://twitter.com/i/web/status/${tweetIds[0]}`
    };
}

function splitIntoTweets(content, maxLength = 280) {
    const tweets = [];
    const lines = content.split('\n');
    let currentTweet = '';

    for (const line of lines) {
        if ((currentTweet + line + '\n').length > maxLength) {
            if (currentTweet) tweets.push(currentTweet.trim());
            currentTweet = line + '\n';
        } else {
            currentTweet += line + '\n';
        }
    }

    if (currentTweet) tweets.push(currentTweet.trim());

    // If still too long, split by sentences
    const finalTweets = [];
    for (const tweet of tweets) {
        if (tweet.length <= maxLength) {
            finalTweets.push(tweet);
        } else {
            // Simple split by character limit
            for (let i = 0; i < tweet.length; i += maxLength) {
                finalTweets.push(tweet.substring(i, i + maxLength));
            }
        }
    }

    return finalTweets.length > 0 ? finalTweets : [content.substring(0, maxLength)];
}

async function publishToLinkedIn(content, credentials, metadata = {}) {
    const { accessToken, personUrn } = credentials;

    if (!accessToken || !personUrn) {
        throw new ApiError('LinkedIn credentials incomplete', 400);
    }

    const body = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
            'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                    text: content
                },
                shareMediaCategory: 'NONE'
            }
        },
        visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`LinkedIn API Error: ${error}`);
    }

    const data = await response.json();
    const postId = data.id;

    return {
        remoteId: postId,
        remoteUrl: `https://www.linkedin.com/feed/update/${postId}`
    };
}

async function createPublishJobs(userId, versionId, integrationIds, scheduledFor, metadata = {}) {
    // Verify content version belongs to user
    const version = await prisma.contentVersion.findUnique({
        where: { id: versionId },
        include: {
            session: true
        }
    });

    if (!version) {
        throw new ApiError(
            'Content version not found',
            404,
            'CONTENT_VERSION_NOT_FOUND',
            'The requested content draft was not found.',
            'versionId'
        );
    }

    if (version.session.userId !== userId) {
        throw new ApiError(
            'Unauthorized access to content version',
            403,
            'CONTENT_ACCESS_DENIED',
            'You do not have permission to publish this content.',
            'versionId'
        );
    }

    // Validate content is not empty
    if (!version.body || version.body.trim() === '') {
        throw new ApiError(
            'Content is empty',
            400,
            'EMPTY_CONTENT',
            'Your content is empty. Please add content before publishing.',
            'versionId'
        );
    }

    // Validate scheduled time is not in the past
    if (scheduledFor) {
        const scheduledDate = new Date(scheduledFor);
        const now = new Date();
        if (scheduledDate <= now) {
            throw new ApiError(
                'Cannot schedule posts in the past',
                400,
                'SCHEDULE_PAST_DATE',
                'Cannot schedule posts in the past. Please select a future date.',
                'scheduledFor'
            );
        }
    }

    const jobs = [];

    // Check for maximum concurrent jobs
    const activeJobsCount = await prisma.publishJob.count({
        where: {
            contentVersion: {
                session: { userId }
            },
            status: { in: ['PENDING', 'RUNNING'] }
        }
    });

    const maxJobs = 10; // Configurable limit
    if (activeJobsCount + integrationIds.length > maxJobs) {
        throw new ApiError(
            'Too many pending publish jobs',
            429,
            'PUBLISH_JOB_LIMIT_EXCEEDED',
            `You've reached the maximum number of pending publish jobs (${activeJobsCount}/${maxJobs}).`,
            'integrationIds',
            { currentJobs: activeJobsCount, maxJobs, requested: integrationIds.length }
        );
    }

    for (const integrationId of integrationIds) {
        // Verify integration belongs to user
        const integration = await prisma.integration.findUnique({
            where: { id: integrationId }
        });

        if (!integration || integration.userId !== userId) {
            throw new ApiError(
                `Integration not found or unauthorized`,
                403,
                'INTEGRATION_ACCESS_DENIED',
                `Cannot publish: No ${integration?.provider || 'platform'} account connected. Please add one in Settings.`,
                'integrationIds',
                { integrationId, provider: integration?.provider }
            );
        }

        // Platform-specific validations
        if (version.platform === 'LINKEDIN' && version.body.length > 3000) {
            throw new ApiError(
                'Content too long for LinkedIn',
                400,
                'CONTENT_TOO_LONG',
                `LinkedIn posts cannot exceed 3000 characters. Current length: ${version.body.length}`,
                'versionId',
                { platform: 'LINKEDIN', maxLength: 3000, currentLength: version.body.length }
            );
        }

        if (version.platform === 'TWITTER' && version.body.length > 280) {
            throw new ApiError(
                'Content too long for Twitter',
                400,
                'CONTENT_TOO_LONG',
                `Twitter posts cannot exceed 280 characters. Current length: ${version.body.length}`,
                'versionId',
                { platform: 'TWITTER', maxLength: 280, currentLength: version.body.length }
            );
        }

        // Create publish job
        const job = await prisma.publishJob.create({
            data: {
                contentId: versionId,
                integrationId: integrationId,
                status: 'PENDING',
                scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
            }
        });

        jobs.push(job);

        // If not scheduled, execute immediately
        if (!scheduledFor) {
            // Execute in background (don't await)
            executePublish(job.id).catch(err => {
                console.error(`Failed to execute publish job ${job.id}:`, err);
            });
        }
    }

    return jobs;
}

async function executePublish(jobId) {
    // Get job with content and integration
    const job = await prisma.publishJob.findUnique({
        where: { id: jobId },
        include: {
            contentVersion: true,
            integration: true
        }
    });

    if (!job) {
        throw new ApiError('Publish job not found', 404);
    }

    // Get userId for WebSocket broadcast
    const userId = await prisma.contentVersion.findUnique({
        where: { id: job.contentId },
        include: { session: { select: { userId: true } } }
    }).then(v => v.session.userId);

    // Update status to RUNNING
    const runningJob = await prisma.publishJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date() },
        include: {
            contentVersion: { select: { platform: true } },
            integration: { select: { provider: true } }
        }
    });

    // Broadcast update
    broadcastPublishUpdate(userId, runningJob);

    try {
        // Get decrypted credentials
        const credentials = await integrationsService.getDecryptedCredentials(
            job.integration.userId,
            job.integration.provider
        );

        if (!credentials) {
            throw new ApiError(
                'Integration credentials not found',
                500,
                'INTEGRATION_CREDENTIALS_MISSING',
                'Your integration credentials could not be retrieved. Please reconnect in Settings.',
                null,
                { provider: job.integration.provider }
            );
        }

        let result;
        const content = job.contentVersion.body;

        // Call appropriate publish function based on provider
        switch (job.integration.provider) {
            case 'WORDPRESS':
                result = await publishToWordPress(content, credentials, job.metadata);
                break;
            case 'TWITTER':
                result = await publishToTwitter(content, credentials);
                break;
            case 'LINKEDIN':
                result = await publishToLinkedIn(content, credentials, job.metadata);
                break;
            default:
                throw new ApiError(
                    `Unsupported publishing platform: ${job.integration.provider}`,
                    400,
                    'UNSUPPORTED_PROVIDER',
                    `Publishing to ${job.integration.provider} is not currently supported.`,
                    null,
                    { provider: job.integration.provider }
                );
        }

        // Update job with success
        const successJob = await prisma.publishJob.update({
            where: { id: jobId },
            data: {
                status: 'SUCCESS',
                remoteId: result.remoteId,
                remoteUrl: result.remoteUrl,
                completedAt: new Date()
            },
            include: {
                contentVersion: { select: { platform: true } },
                integration: { select: { provider: true } }
            }
        });

        // Broadcast success
        broadcastPublishUpdate(userId, successJob);

        // Update content version status
        await prisma.contentVersion.update({
            where: { id: job.contentId },
            data: { status: 'PUBLISHED' }
        });

        return result;

    } catch (error) {
        // Update job with failure
        const failedJob = await prisma.publishJob.update({
            where: { id: jobId },
            data: {
                status: 'FAILED',
                log: {
                    error: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                },
                completedAt: new Date()
            },
            include: {
                contentVersion: { select: { platform: true } },
                integration: { select: { provider: true } }
            }
        });

        // Broadcast failure
        broadcastPublishUpdate(userId, failedJob);

        throw error;
    }
}

async function getPublishJobs(userId, filters = {}) {
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

    const jobs = await prisma.publishJob.findMany({
        where,
        include: {
            contentVersion: {
                select: {
                    platform: true,
                    body: true
                }
            },
            integration: {
                select: {
                    provider: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return jobs.map(job => ({
        id: job.id,
        content: job.contentVersion,
        integration: job.integration,
        status: job.status,
        remoteId: job.remoteId,
        remoteUrl: job.remoteUrl,
        scheduledFor: job.scheduledFor,
        log: job.log,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt
    }));
}

async function retryPublishJob(jobId, userId) {
    // Verify job belongs to user
    const job = await prisma.publishJob.findUnique({
        where: { id: jobId },
        include: {
            contentVersion: {
                include: {
                    session: true
                }
            }
        }
    });

    if (!job) {
        throw new ApiError('Publish job not found', 404);
    }

    if (job.contentVersion.session.userId !== userId) {
        throw new ApiError('Unauthorized access to publish job', 403);
    }

    // Reset status to PENDING
    await prisma.publishJob.update({
        where: { id: jobId },
        data: {
            status: 'PENDING',
            startedAt: null,
            completedAt: null
        }
    });

    // Execute immediately
    executePublish(jobId).catch(err => {
        console.error(`Failed to retry publish job ${jobId}:`, err);
    });

    return { id: jobId, status: 'PENDING' };
}

async function cancelPublishJob(jobId, userId) {
    // Verify job belongs to user
    const job = await prisma.publishJob.findUnique({
        where: { id: jobId },
        include: {
            contentVersion: {
                include: {
                    session: true
                }
            }
        }
    });

    if (!job) {
        throw new ApiError('Publish job not found', 404);
    }

    if (job.contentVersion.session.userId !== userId) {
        throw new ApiError('Unauthorized access to publish job', 403);
    }

    // Can only cancel PENDING or SCHEDULED jobs
    if (job.status !== 'PENDING' && job.status !== 'SCHEDULED') {
        throw new ApiError(
            `Cannot cancel job with status: ${job.status}`,
            400,
            'JOB_CANNOT_CANCEL',
            'Failed to cancel job. It may already be completed.',
            'jobId',
            { currentStatus: job.status }
        );
    }

    // Update status to CANCELLED
    await prisma.publishJob.update({
        where: { id: jobId },
        data: {
            status: 'FAILED',
            log: {
                error: 'Job cancelled by user',
                timestamp: new Date().toISOString()
            },
            completedAt: new Date()
        }
    });

    return { id: jobId, status: 'CANCELLED' };
}

async function updatePublishSchedule(jobId, userId, scheduledFor) {
    // Verify job belongs to user
    const job = await prisma.publishJob.findUnique({
        where: { id: jobId },
        include: {
            contentVersion: {
                include: {
                    session: true
                }
            }
        }
    });

    if (!job) {
        throw new ApiError('Publish job not found', 404);
    }

    if (job.contentVersion.session.userId !== userId) {
        throw new ApiError('Unauthorized access to publish job', 403);
    }

    // Can only update schedule for PENDING or SCHEDULED jobs
    if (job.status !== 'PENDING' && job.status !== 'SCHEDULED') {
        throw new ApiError(
            `Cannot update schedule for job with status: ${job.status}`,
            400,
            'JOB_CANNOT_RESCHEDULE',
            'Cannot reschedule a job that is already running or completed.',
            'jobId',
            { currentStatus: job.status }
        );
    }

    // Update scheduled time
    const updated = await prisma.publishJob.update({
        where: { id: jobId },
        data: {
            scheduledFor: new Date(scheduledFor),
            status: 'PENDING'
        }
    });

    return updated;
}

module.exports = {
    publishToWordPress,
    publishToTwitter,
    publishToLinkedIn,
    createPublishJobs,
    executePublish,
    getPublishJobs,
    retryPublishJob,
    cancelPublishJob,
    updatePublishSchedule
};
