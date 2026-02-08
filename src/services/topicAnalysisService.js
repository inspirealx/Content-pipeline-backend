// src/services/topicAnalysisService.js
const prisma = require('../db/prismaClient');
const { callGeminiAPI, callOpenAIAPI } = require('./aiService');
const scraperService = require('./scraperService');

class TopicAnalysisService {
    /**
     * Extract JSON from AI response (handles markdown code blocks and edge cases)
     * @param {string} text - AI response text
     * @returns {object} Parsed JSON object
     */
    extractJSON(text) {
        try {
            // First, try to find JSON within markdown code blocks
            let jsonString;

            // Try triple backtick with json
            const jsonMatch1 = text.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch1) {
                jsonString = jsonMatch1[1];
            } else {
                // Try triple backtick without json
                const jsonMatch2 = text.match(/```\s*([\s\S]*?)\s*```/);
                if (jsonMatch2) {
                    jsonString = jsonMatch2[1];
                } else {
                    // No markdown blocks, use the whole text
                    jsonString = text;
                }
            }

            // Clean up the string
            jsonString = jsonString.trim();

            // Remove any BOM or invisible characters at the start
            jsonString = jsonString.replace(/^\uFEFF/, '');
            jsonString = jsonString.replace(/^[\s\n\r]+/, '');
            jsonString = jsonString.replace(/[\s\n\r]+$/, '');

            // Try to find the JSON object boundaries
            const firstBrace = jsonString.indexOf('{');
            const lastBrace = jsonString.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            }

            // Parse and return
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('[TopicAnalysis] JSON parsing error:', error.message);
            console.error('[TopicAnalysis] Problematic text:', text.substring(0, 500));

            // Last resort: try to parse the original text
            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error(`Failed to extract JSON from AI response: ${error.message}`);
            }
        }
    }

    /**
     * Get user's AI integration and niche
     * @param {string} userId - User ID
     * @returns {Promise<object>} User integration and niche
     */
    async getUserIntegration(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                integrations: {
                    where: {
                        OR: [
                            { provider: 'GEMINI' },
                            { provider: 'OPENAI' }
                        ],
                        isActive: true
                    },
                    take: 1
                }
            }
        });

        if (!user || !user.integrations || user.integrations.length === 0) {
            throw new Error('No active AI integration found for user');
        }

        return {
            integration: user.integrations[0],
            niche: user.niche || 'General',
            nicheDetails: user.nicheDetails
        };
    }

    /**
     * Call AI with user's configured provider
     * @param {string} userId - User ID
     * @param {string} prompt - AI prompt
     * @returns {Promise<string>} AI response
     */
    async callAI(userId, prompt) {
        const { integration } = await this.getUserIntegration(userId);

        // Parse credentials - handle both JSON string and object formats
        let credentials;
        if (typeof integration.credentialsEncrypted === 'string') {
            try {
                // Clean the string before parsing
                let credString = integration.credentialsEncrypted.trim();
                // Remove BOM if present
                credString = credString.replace(/^\uFEFF/, '');
                credentials = JSON.parse(credString);
            } catch (error) {
                console.error('[TopicAnalysis] Credentials parsing error:', error.message);
                console.error('[TopicAnalysis] Raw credentials:', integration.credentialsEncrypted.substring(0, 100));
                throw new Error('Failed to parse AI integration credentials. Please reconfigure your integration.');
            }
        } else {
            // Already an object
            credentials = integration.credentialsEncrypted;
        }

        const apiKey = credentials.apiKey;

        if (!apiKey) {
            throw new Error('API key not found in integration credentials');
        }

        if (integration.provider === 'GEMINI') {
            return await callGeminiAPI(prompt, apiKey);
        } else if (integration.provider === 'OPENAI') {
            return await callOpenAIAPI(prompt, apiKey);
        } else {
            throw new Error(`Unsupported AI provider: ${integration.provider}`);
        }
    }

    /**
     * Normalize topic using AI
     * @param {string} rawTopic - Raw topic input
     * @param {string} userId - User ID
     * @param {string} userNiche - User's niche
     * @returns {Promise<object>} Normalized topic data
     */
    async normalizeTopic(rawTopic, userId, userNiche) {
        const prompt = `Analyze this topic and extract key information.

Topic: "${rawTopic}"
User's Industry/Niche: ${userNiche}

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "mainTopic": "concise, focused topic name",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "category": "industry category",
  "targetAudience": "specific audience description for ${userNiche} industry",
  "relatedTerms": ["term1", "term2", "term3"]
}`;

        try {
            const response = await this.callAI(userId, prompt);
            return this.extractJSON(response);
        } catch (error) {
            console.error('[TopicAnalysis] Topic normalization error:', error.message);
            // Fallback to basic normalization
            return {
                mainTopic: rawTopic,
                keywords: [rawTopic],
                category: userNiche,
                targetAudience: `Professionals in ${userNiche}`,
                relatedTerms: []
            };
        }
    }

    /**
     * Analyze Reddit discussions
     * @param {array} keywords - Array of keywords
     * @returns {Promise<object>} Reddit analysis
     */
    async analyzeReddit(keywords) {
        try {
            const query = keywords.join(' OR ');
            const redditData = await scraperService.scrapeReddit(query, {
                timeFilter: 'month',
                limit: 50
            });

            // Extract pain points (posts/comments with negative sentiment words)
            const painPointKeywords = ['problem', 'issue', 'struggle', 'difficulty', 'challenge', 'frustrating', 'hard to'];
            const painPoints = [];

            for (const post of redditData.posts) {
                const text = `${post.title} ${post.content}`.toLowerCase();
                if (painPointKeywords.some(keyword => text.includes(keyword))) {
                    painPoints.push({
                        text: post.title,
                        score: post.score,
                        source: 'post'
                    });
                }

                for (const comment of post.comments || []) {
                    const commentText = comment.body.toLowerCase();
                    if (painPointKeywords.some(keyword => commentText.includes(keyword))) {
                        painPoints.push({
                            text: comment.body.substring(0, 200),
                            score: comment.score,
                            source: 'comment'
                        });
                    }
                }
            }

            // Calculate sentiment (simple: positive score vs negative)
            const totalScore = redditData.posts.reduce((sum, post) => sum + post.score, 0);
            const avgScore = redditData.posts.length > 0 ? totalScore / redditData.posts.length : 0;
            const sentiment = avgScore > 10 ? 'positive' : avgScore > 0 ? 'neutral' : 'negative';

            // Calculate engagement metrics
            const totalComments = redditData.posts.reduce((sum, post) => sum + post.numComments, 0);
            const avgComments = redditData.posts.length > 0 ? totalComments / redditData.posts.length : 0;

            return {
                discussions: redditData.posts,
                commonPainPoints: painPoints.sort((a, b) => b.score - a.score).slice(0, 5),
                sentiment,
                engagementMetrics: {
                    totalPosts: redditData.posts.length,
                    avgScore: Math.round(avgScore),
                    avgComments: Math.round(avgComments)
                }
            };
        } catch (error) {
            console.error('[TopicAnalysis] Reddit analysis error:', error.message);
            return {
                discussions: [],
                commonPainPoints: [],
                sentiment: 'unknown',
                engagementMetrics: { totalPosts: 0, avgScore: 0, avgComments: 0 }
            };
        }
    }

    /**
     * Analyze Google Trends
     * @param {array} keywords - Array of keywords
     * @returns {Promise<object>} Trends analysis
     */
    async analyzeGoogleTrends(keywords) {
        try {
            const trendsData = await scraperService.getGoogleTrends(keywords);

            // Determine trending status
            let trendingStatus = 'stable';
            if (trendsData.interestOverTime && trendsData.interestOverTime.length > 10) {
                const recentData = trendsData.interestOverTime.slice(-10);
                const olderData = trendsData.interestOverTime.slice(0, 10);

                const recentAvg = recentData.reduce((sum, item) => sum + (item.value?.[0] || 0), 0) / recentData.length;
                const olderAvg = olderData.reduce((sum, item) => sum + (item.value?.[0] || 0), 0) / olderData.length;

                if (recentAvg > olderAvg * 1.2) trendingStatus = 'rising';
                else if (recentAvg < olderAvg * 0.8) trendingStatus = 'declining';
            }

            return {
                interestOverTime: trendsData.interestOverTime,
                relatedQueries: trendsData.relatedQueries.map(q => q.query || q.formattedValue).slice(0, 10),
                risingTopics: trendsData.risingTopics.map(t => t.topic?.title || t.formattedValue).slice(0, 5),
                trendingStatus
            };
        } catch (error) {
            console.error('[TopicAnalysis] Trends analysis error:', error.message);
            return {
                interestOverTime: [],
                relatedQueries: [],
                risingTopics: [],
                trendingStatus: 'unknown'
            };
        }
    }

    /**
     * Analyze Google Search results
     * @param {array} keywords - Array of keywords
     * @returns {Promise<object>} Search analysis
     */
    async analyzeGoogleSearch(keywords) {
        try {
            const query = keywords.slice(0, 3).join(' ');
            const searchData = await scraperService.scrapeGoogleSearch(query);

            // Identify content gaps
            const contentFormats = ['tutorial', 'guide', 'how to', 'comparison', 'review', 'best'];
            const contentGaps = [];

            for (const format of contentFormats) {
                const hasFormat = searchData.organic.some(result =>
                    result.title.toLowerCase().includes(format)
                );
                if (!hasFormat) {
                    contentGaps.push(`${format} content`);
                }
            }

            return {
                topResults: searchData.organic.map(r => ({
                    title: r.title,
                    snippet: r.snippet
                })).slice(0, 5),
                peopleAlsoAsk: searchData.peopleAlsoAsk,
                relatedSearches: searchData.relatedSearches,
                contentGaps: contentGaps.slice(0, 3)
            };
        } catch (error) {
            console.error('[TopicAnalysis] Search analysis error:', error.message);
            return {
                topResults: [],
                peopleAlsoAsk: [],
                relatedSearches: [],
                contentGaps: []
            };
        }
    }

    /**
     * Build structured content brief using AI
     * @param {object} researchData - Compiled research data
     * @param {string} userId - User ID
     * @param {string} userNiche - User's niche
     * @returns {Promise<object>} Structured brief
     */
    async buildStructuredBrief(researchData, userId, userNiche) {
        const { normalized, reddit, trends, search } = researchData;

        const prompt = `You are an expert content strategist specializing in the ${userNiche} industry.

Analyze this research data and create a comprehensive content brief:

TOPIC: ${normalized.mainTopic}
USER'S NICHE/INDUSTRY: ${userNiche}
KEYWORDS: ${normalized.keywords.join(', ')}

REDDIT INSIGHTS:
- Total discussions analyzed: ${reddit.engagementMetrics.totalPosts}
- Top pain points: ${reddit.commonPainPoints.map(p => p.text).slice(0, 3).join('; ')}
- Overall sentiment: ${reddit.sentiment}
- Average engagement: ${reddit.engagementMetrics.avgComments} comments per post

GOOGLE TRENDS:
- Trending status: ${trends.trendingStatus}
- Related queries: ${trends.relatedQueries.slice(0, 5).join(', ')}
- Rising topics: ${trends.risingTopics.slice(0, 3).join(', ')}

SEARCH INSIGHTS:
- Top ranking content analyzed: ${search.topResults.length} results
- People also ask: ${search.peopleAlsoAsk.slice(0, 3).join('; ')}
- Content gaps identified: ${search.contentGaps.join(', ')}

Return ONLY a JSON object with this EXACT structure (no markdown, no explanation):
{
  "topicOverview": {
    "title": "compelling, ${userNiche}-focused title",
    "description": "2-3 sentence overview relevant to ${userNiche} professionals",
    "relevanceScore": 85,
    "trendingStatus": "rising|stable|declining"
  },
  "audienceInsights": {
    "primaryAudience": "detailed persona for ${userNiche}",
    "painPoints": ["specific pain point 1", "specific pain point 2", "specific pain point 3"],
    "goals": ["goal 1", "goal 2"],
    "knowledgeLevel": "beginner|intermediate|expert",
    "commonQuestions": ["question 1", "question 2", "question 3"]
  },
  "contentAngles": [
    {
      "angle": "unique perspective or hook",
      "rationale": "why this works for ${userNiche}",
      "platforms": ["linkedin", "twitter", "blog"],
      "estimatedEngagement": "high|medium|low"
    }
  ],
  "keyMessages": ["message 1 specific to ${userNiche}", "message 2", "message 3"],
  "competitiveInsights": {
    "gapOpportunities": ["gap 1", "gap 2"],
    "popularFormats": ["format 1", "format 2"],
    "toneTrends": "professional|casual|educational for ${userNiche}"
  },
  "platformRecommendations": {
    "linkedin": {
      "format": "article|post|carousel",
      "tone": "description appropriate for ${userNiche}",
      "keyPoints": ["point 1", "point 2", "point 3"],
      "hooks": ["hook 1", "hook 2"]
    },
    "twitter": {
      "format": "thread|single|quote",
      "tone": "description",
      "keyPoints": ["point 1", "point 2"],
      "hooks": ["hook 1", "hook 2"]
    },
    "blog": {
      "format": "listicle|howto|analysis",
      "tone": "description",
      "structure": ["section 1", "section 2", "section 3"],
      "seoKeywords": ["keyword 1", "keyword 2", "keyword 3"]
    },
    "reelScript": {
      "hook": "attention-grabbing opening",
      "keyMoments": ["moment 1", "moment 2", "moment 3"],
      "cta": "call to action",
      "duration": "30-60 seconds"
    }
  },
  "supportingData": {
    "statistics": ["stat 1", "stat 2"],
    "examples": ["example 1", "example 2"],
    "quotes": ["insightful quote 1"]
  }
}`;

        try {
            const response = await this.callAI(userId, prompt);
            const brief = this.extractJSON(response);

            // Add metadata
            brief.userNiche = userNiche;
            brief.generatedAt = new Date().toISOString();

            return brief;
        } catch (error) {
            console.error('[TopicAnalysis] Brief generation error:', error.message);
            throw error;
        }
    }

    /**
     * Main method: Analyze topic comprehensively
     * @param {string} topic - Topic to analyze
     * @param {string} userId - User ID
     * @returns {Promise<object>} Complete analysis with brief
     */
    async analyzeTopicComprehensive(topic, userId) {
        try {
            console.log(`[TopicAnalysis] Starting analysis for: ${topic}`);

            // Get user's niche
            const { niche: userNiche } = await this.getUserIntegration(userId);
            console.log(`[TopicAnalysis] User niche: ${userNiche}`);

            // Step 1: Normalize topic
            const normalized = await this.normalizeTopic(topic, userId, userNiche);
            console.log(`[TopicAnalysis] Normalized topic:`, normalized);

            // Step 2: Run parallel research (use Promise.allSettled to not fail if one source fails)
            const [redditResult, trendsResult, searchResult] = await Promise.allSettled([
                this.analyzeReddit(normalized.keywords),
                this.analyzeGoogleTrends(normalized.keywords),
                this.analyzeGoogleSearch(normalized.keywords)
            ]);

            const reddit = redditResult.status === 'fulfilled' ? redditResult.value : {
                discussions: [], commonPainPoints: [], sentiment: 'unknown',
                engagementMetrics: { totalPosts: 0, avgScore: 0, avgComments: 0 }
            };

            const trends = trendsResult.status === 'fulfilled' ? trendsResult.value : {
                interestOverTime: [], relatedQueries: [], risingTopics: [], trendingStatus: 'unknown'
            };

            const search = searchResult.status === 'fulfilled' ? searchResult.value : {
                topResults: [], peopleAlsoAsk: [], relatedSearches: [], contentGaps: []
            };

            console.log(`[TopicAnalysis] Research complete. Reddit: ${reddit.discussions.length} posts, Trends: ${trends.trendingStatus}, Search: ${search.topResults.length} results`);

            // Step 3: Build structured brief
            const researchData = { normalized, reddit, trends, search };
            const brief = await this.buildStructuredBrief(researchData, userId, userNiche);

            console.log(`[TopicAnalysis] Brief generated successfully`);

            return {
                success: true,
                brief,
                rawData: {
                    normalized,
                    reddit,
                    trends,
                    search
                },
                analyzedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('[TopicAnalysis] Comprehensive analysis error:', error.message);
            throw error;
        }
    }
}

module.exports = new TopicAnalysisService();
