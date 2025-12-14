// src/services/analyticsService.js
const prisma = require('../db/prismaClient');
const integrationsService = require('./integrationsService');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

function parseDateRange(startDate, endDate, defaultDays = 30) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Validate
    if (start > end) {
        throw new Error('Start date must be before end date');
    }

    // Limit to 1 year
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (end - start > oneYear) {
        throw new Error('Date range cannot exceed 1 year');
    }

    return { start, end };
}

async function getDashboardStatsForUser(userId) {
    const cacheKey = `dashboard:${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // Get counts
    const [totalContent, publishedContent, draftContent, integrations] = await Promise.all([
        prisma.contentSession.count({ where: { userId } }),
        prisma.contentVersion.count({
            where: {
                session: { userId },
                status: 'PUBLISHED'
            }
        }),
        prisma.contentVersion.count({
            where: {
                session: { userId },
                status: 'DRAFT'
            }
        }),
        prisma.integration.count({ where: { userId, isActive: true } })
    ]);

    // Get publish jobs for success rate
    const publishJobs = await prisma.publishJob.findMany({
        where: {
            contentVersion: {
                session: { userId }
            }
        },
        select: { status: true, startedAt: true, completedAt: true }
    });

    const successfulJobs = publishJobs.filter(j => j.status === 'SUCCESS').length;
    const totalJobs = publishJobs.length;
    const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0;

    // Calculate average time to publish (in hours)
    const completedJobs = publishJobs.filter(j => j.startedAt && j.completedAt);
    const avgTimeToPublish = completedJobs.length > 0
        ? completedJobs.reduce((sum, j) => {
            return sum + (new Date(j.completedAt) - new Date(j.startedAt));
        }, 0) / completedJobs.length / (1000 * 60 * 60) // Convert to hours
        : 0;

    // Get recent activity (last 10 published items)
    const recentActivity = await prisma.publishJob.findMany({
        where: {
            contentVersion: {
                session: { userId }
            },
            status: 'SUCCESS'
        },
        include: {
            contentVersion: {
                select: { platform: true }
            },
            integration: {
                select: { provider: true }
            }
        },
        orderBy: { completedAt: 'desc' },
        take: 10
    });

    const stats = {
        totalContent,
        publishedCount: publishedContent,
        draftCount: draftContent,
        connectedIntegrations: integrations,
        successRate: Math.round(successRate * 10) / 10,
        avgTimeToPublish: Math.round(avgTimeToPublish * 10) / 10,
        recentActivity: recentActivity.map(job => ({
            type: 'PUBLISHED',
            title: job.remoteUrl || 'Published Content',
            platform: job.integration.provider,
            timestamp: job.completedAt
        }))
    };

    setCache(cacheKey, stats);
    return stats;
}

async function getContentMetrics(userId, dateRange) {
    const { start, end } = parseDateRange(dateRange?.startDate, dateRange?.endDate);

    const contentVersions = await prisma.contentVersion.findMany({
        where: {
            session: { userId },
            createdAt: {
                gte: start,
                lte: end
            }
        },
        select: {
            platform: true,
            status: true
        }
    });

    // Group by platform
    const platformStats = {};
    contentVersions.forEach(cv => {
        if (!platformStats[cv.platform]) {
            platformStats[cv.platform] = {
                platform: cv.platform,
                total: 0,
                published: 0,
                draft: 0,
                failed: 0
            };
        }

        platformStats[cv.platform].total++;
        if (cv.status === 'PUBLISHED') platformStats[cv.platform].published++;
        else if (cv.status === 'DRAFT') platformStats[cv.platform].draft++;
        else if (cv.status === 'FAILED') platformStats[cv.platform].failed++;
    });

    const byPlatform = Object.values(platformStats);
    const totalContent = contentVersions.length;
    const publishedContent = contentVersions.filter(cv => cv.status === 'PUBLISHED').length;
    const completionRate = totalContent > 0 ? (publishedContent / totalContent) * 100 : 0;

    return {
        byPlatform,
        completionRate: Math.round(completionRate * 10) / 10
    };
}

async function getPublishingMetrics(userId, days = 30) {
    const { start, end } = parseDateRange(null, null, days);

    const publishJobs = await prisma.publishJob.findMany({
        where: {
            contentVersion: {
                session: { userId }
            },
            createdAt: {
                gte: start,
                lte: end
            }
        },
        include: {
            integration: {
                select: { provider: true }
            }
        },
        orderBy: { createdAt: 'asc' }
    });

    const totalJobs = publishJobs.length;
    const successful = publishJobs.filter(j => j.status === 'SUCCESS').length;
    const failed = publishJobs.filter(j => j.status === 'FAILED').length;
    const pending = publishJobs.filter(j => j.status === 'PENDING').length;
    const successRate = totalJobs > 0 ? (successful / totalJobs) * 100 : 0;

    // Calculate average publish time
    const completedJobs = publishJobs.filter(j => j.startedAt && j.completedAt);
    const avgPublishTime = completedJobs.length > 0
        ? completedJobs.reduce((sum, j) => {
            return sum + (new Date(j.completedAt) - new Date(j.startedAt));
        }, 0) / completedJobs.length / 1000 // Convert to seconds
        : 0;

    // Timeline data (group by date)
    const timeline = {};
    publishJobs.forEach(job => {
        const date = new Date(job.createdAt).toISOString().split('T')[0];
        if (!timeline[date]) {
            timeline[date] = { date, successful: 0, failed: 0 };
        }
        if (job.status === 'SUCCESS') timeline[date].successful++;
        if (job.status === 'FAILED') timeline[date].failed++;
    });

    // By platform
    const byPlatform = {};
    publishJobs.forEach(job => {
        const provider = job.integration.provider;
        if (!byPlatform[provider]) {
            byPlatform[provider] = { success: 0, failed: 0 };
        }
        if (job.status === 'SUCCESS') byPlatform[provider].success++;
        if (job.status === 'FAILED') byPlatform[provider].failed++;
    });

    return {
        successRate: Math.round(successRate * 10) / 10,
        totalJobs,
        successful,
        failed,
        pending,
        avgPublishTime: Math.round(avgPublishTime * 10) / 10,
        timeline: Object.values(timeline),
        byPlatform
    };
}

async function checkIntegrationHealth(userId) {
    const integrations = await prisma.integration.findMany({
        where: { userId },
        include: {
            publishJobs: {
                orderBy: { completedAt: 'desc' },
                take: 1,
                where: { status: 'SUCCESS' }
            },
            _count: {
                select: {
                    publishJobs: true
                }
            }
        }
    });

    const healthReports = await Promise.all(integrations.map(async (integration) => {
        const lastSuccessful = integration.publishJobs[0]?.completedAt || null;
        const totalPublishes = integration._count.publishJobs;

        // Get all jobs for this integration to calculate uptime
        const allJobs = await prisma.publishJob.findMany({
            where: { integrationId: integration.id },
            select: { status: true }
        });

        const successfulCount = allJobs.filter(j => j.status === 'SUCCESS').length;
        const uptime = allJobs.length > 0 ? (successfulCount / allJobs.length) * 100 : 100;

        // Test connection (simplified - just check if credentials exist)
        let status = 'HEALTHY';
        let error = null;

        try {
            const credentials = await integrationsService.getDecryptedCredentials(userId, integration.provider);
            if (!credentials) {
                status = 'ERROR';
                error = 'No credentials found';
            }
        } catch (e) {
            status = 'ERROR';
            error = e.message;
        }

        // If no recent successful publish in last 7 days, mark as warning
        if (lastSuccessful) {
            const daysSinceSuccess = (Date.now() - new Date(lastSuccessful)) / (1000 * 60 * 60 * 24);
            if (daysSinceSuccess > 7 && status === 'HEALTHY') {
                status = 'WARNING';
            }
        }

        return {
            id: integration.id,
            provider: integration.provider,
            status,
            lastSuccessful,
            error,
            uptime: Math.round(uptime * 10) / 10,
            totalPublishes
        };
    }));

    return { integrations: healthReports };
}

module.exports = {
    getDashboardStatsForUser,
    getContentMetrics,
    getPublishingMetrics,
    checkIntegrationHealth
};
