// src/services/platformContentService.js
const prisma = require('../db/prismaClient');
const { callGeminiAPI, callOpenAIAPI } = require('./aiService');

class PlatformContentService {
    /**
     * Extract JSON from AI response (handles markdown code blocks)
     * @param {string} text - AI response text
     * @returns {object} Parsed JSON object
     */
    extractJSON(text) {
        try {
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
            const jsonString = jsonMatch ? jsonMatch[1] : text;
            return JSON.parse(jsonString.trim());
        } catch (error) {
            console.error('[PlatformContent] JSON parsing error:', error.message);
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
        const credentials = JSON.parse(integration.credentialsEncrypted);
        const apiKey = credentials.apiKey;

        if (integration.provider === 'GEMINI') {
            return await callGeminiAPI(prompt, apiKey);
        } else if (integration.provider === 'OPENAI') {
            return await callOpenAIAPI(prompt, apiKey);
        } else {
            throw new Error(`Unsupported AI provider: ${integration.provider}`);
        }
    }

    /**
     * Format user answers for AI prompts
     * @param {array} userAnswers - Array of Q&A objects
     * @returns {string} Formatted text
     */
    formatUserAnswers(userAnswers) {
        if (!userAnswers || userAnswers.length === 0) {
            return 'No additional user insights provided.';
        }

        return userAnswers.map((qa, index) =>
            `Q${index + 1}: ${qa.question}\nA${index + 1}: ${qa.answer}`
        ).join('\n\n');
    }

    /**
     * Generate LinkedIn content
     * @param {object} brief - Content brief
     * @param {array} userAnswers - User Q&A
     * @param {string} userId - User ID
     * @param {string} userNiche - User's niche
     * @returns {Promise<object>} LinkedIn content
     */
    async generateLinkedInContent(brief, userAnswers, userId, userNiche) {
        const prompt = `Generate professional LinkedIn content for the ${userNiche} industry.

NICHE: ${userNiche}
TOPIC: ${brief.topicOverview.title}
DESCRIPTION: ${brief.topicOverview.description}
TARGET AUDIENCE: ${brief.audienceInsights.primaryAudience}
KEY MESSAGES: ${brief.keyMessages.join('; ')}

PLATFORM RECOMMENDATIONS:
${JSON.stringify(brief.platformRecommendations.linkedin, null, 2)}

USER INSIGHTS:
${this.formatUserAnswers(userAnswers)}

Create LinkedIn content that:
- Uses industry-specific terminology relevant to ${userNiche}
- References challenges common in the ${userNiche} sector
- Includes statistics or examples from ${userNiche}
- Follows LinkedIn best practices (engaging hook, value-packed body, clear CTA)

Return ONLY a JSON object (no markdown, no explanation):
{
  "post": {
    "hook": "compelling first line that stops scrolling",
    "body": "main content with line breaks for readability (use \\n\\n)",
    "cta": "clear call to action",
    "hashtags": ["#tag1", "#tag2", "#tag3"]
  },
  "variants": [
    {"type": "short", "content": "250 characters max"},
    {"type": "medium", "content": "500 characters"},
    {"type": "long", "content": "1000 characters"}
  ],
  "performanceTips": ["tip 1", "tip 2", "tip 3"]
}`;

        try {
            const response = await this.callAI(userId, prompt);
            return this.extractJSON(response);
        } catch (error) {
            console.error('[PlatformContent] LinkedIn generation error:', error.message);
            throw error;
        }
    }

    /**
     * Generate Twitter content
     * @param {object} brief - Content brief
     * @param {array} userAnswers - User Q&A
     * @param {string} userId - User ID
     * @param {string} userNiche - User's niche
     * @returns {Promise<object>} Twitter content
     */
    async generateTwitterContent(brief, userAnswers, userId, userNiche) {
        const prompt = `Generate engaging Twitter content for the ${userNiche} industry.

NICHE: ${userNiche}
TOPIC: ${brief.topicOverview.title}
TARGET AUDIENCE: ${brief.audienceInsights.primaryAudience}
KEY MESSAGES: ${brief.keyMessages.join('; ')}

PLATFORM RECOMMENDATIONS:
${JSON.stringify(brief.platformRecommendations.twitter, null, 2)}

USER INSIGHTS:
${this.formatUserAnswers(userAnswers)}

Create Twitter content that:
- Uses ${userNiche}-specific hashtags and trends
- Keeps tweets under 280 characters
- Includes industry examples and insights
- Creates a cohesive thread that tells a story

Return ONLY a JSON object (no markdown):
{
  "thread": [
    {"tweetNumber": 1, "content": "<280 chars", "note": "hook tweet"},
    {"tweetNumber": 2, "content": "<280 chars", "note": "value point 1"},
    {"tweetNumber": 3, "content": "<280 chars", "note": "value point 2"},
    {"tweetNumber": 4, "content": "<280 chars", "note": "conclusion/CTA"}
  ],
  "singleTweet": {
    "content": "standalone tweet <280 chars",
    "alternative": "alternative version"
  },
  "quoteTweet": {
    "quote": "hypothetical quote to share",
    "commentary": "your commentary on it"
  },
  "hashtags": ["#relevant1", "#relevant2", "#${userNiche}"]
}`;

        try {
            const response = await this.callAI(userId, prompt);
            return this.extractJSON(response);
        } catch (error) {
            console.error('[PlatformContent] Twitter generation error:', error.message);
            throw error;
        }
    }

    /**
     * Generate blog article content
     * @param {object} brief - Content brief
     * @param {array} userAnswers - User Q&A
     * @param {string} userId - User ID
     * @param {string} userNiche - User's niche
     * @returns {Promise<object>} Blog content
     */
    async generateBlogContent(brief, userAnswers, userId, userNiche) {
        const prompt = `Generate a comprehensive blog article for the ${userNiche} industry.

NICHE: ${userNiche}
TOPIC: ${brief.topicOverview.title}
DESCRIPTION: ${brief.topicOverview.description}
TARGET AUDIENCE: ${brief.audienceInsights.primaryAudience}
PAIN POINTS: ${brief.audienceInsights.painPoints.join('; ')}
KEY MESSAGES: ${brief.keyMessages.join('; ')}

PLATFORM RECOMMENDATIONS:
${JSON.stringify(brief.platformRecommendations.blog, null, 2)}

USER INSIGHTS:
${this.formatUserAnswers(userAnswers)}

Create a blog article that:
- Uses SEO keywords specific to ${userNiche}
- Provides actionable insights for ${userNiche} professionals
- Includes industry-specific examples and case studies
- Follows a clear structure with H2/H3 headings

Return ONLY a JSON object (no markdown):
{
  "article": {
    "title": "SEO-optimized title for ${userNiche}",
    "metaDescription": "155 character meta description",
    "introduction": "2-3 paragraphs introducing the topic",
    "sections": [
      {
        "heading": "Section 1 heading",
        "content": "section content with specific ${userNiche} examples",
        "keyTakeaway": "main point"
      },
      {
        "heading": "Section 2 heading",
        "content": "section content",
        "keyTakeaway": "main point"
      },
      {
        "heading": "Section 3 heading",
        "content": "section content",
        "keyTakeaway": "main point"
      }
    ],
    "conclusion": "2 paragraphs wrapping up with CTA",
    "faqs": [
      {"question": "relevant FAQ 1", "answer": "answer"},
      {"question": "relevant FAQ 2", "answer": "answer"}
    ]
  },
  "seoMetadata": {
    "focusKeyword": "primary keyword",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "slug": "url-friendly-slug",
    "category": "${userNiche}"
  },
  "readingTime": "8-10 minutes",
  "targetWordCount": "1500-2000 words"
}`;

        try {
            const response = await this.callAI(userId, prompt);
            return this.extractJSON(response);
        } catch (error) {
            console.error('[PlatformContent] Blog generation error:', error.message);
            throw error;
        }
    }

    /**
     * Generate reel/video script
     * @param {object} brief - Content brief
     * @param {array} userAnswers - User Q&A
     * @param {string} userId - User ID
     * @param {string} userNiche - User's niche
     * @returns {Promise<object>} Reel script
     */
    async generateReelScript(brief, userAnswers, userId, userNiche) {
        const prompt = `Generate a reel/short video script for the ${userNiche} industry.

NICHE: ${userNiche}
TOPIC: ${brief.topicOverview.title}
TARGET AUDIENCE: ${brief.audienceInsights.primaryAudience}
KEY MESSAGES: ${brief.keyMessages.join('; ')}

PLATFORM RECOMMENDATIONS:
${JSON.stringify(brief.platformRecommendations.reelScript, null, 2)}

USER INSIGHTS:
${this.formatUserAnswers(userAnswers)}

Create a reel script that:
- Uses visual language appropriate for ${userNiche}
- Hooks viewers in first 2 seconds
- Delivers value quickly
- Includes on-screen text suggestions
- Adapts well to Instagram, TikTok, YouTube Shorts

Return ONLY a JSON object (no markdown):
{
  "script": {
    "hook": "Opening line (0-2 seconds)",
    "body": [
      {"scene": 1, "duration": "3-5 sec", "visual": "what to show", "voiceover": "what to say", "onScreenText": "text overlay"},
      {"scene": 2, "duration": "3-5 sec", "visual": "what to show", "voiceover": "what to say", "onScreenText": "text overlay"},
      {"scene": 3, "duration": "3-5 sec", "visual": "what to show", "voiceover": "what to say", "onScreenText": "text overlay"}
    ],
    "cta": "Clear call to action"
  },
  "production": {
    "totalDuration": "30-45 seconds",
    "suggestedMusic": "upbeat|calm|energetic",
    "visualStyle": "description of visual aesthetic for ${userNiche}",
    "transitions": ["transition style 1", "transition style 2"]
  },
  "platforms": {
    "instagram": {"caption": "caption with hashtags", "hashtags": ["#tag1", "#tag2"]},
    "tiktok": {"caption": "caption", "trending_sounds": ["sound1"]},
    "youtube": {"title": "title", "description": "description"}
  }
}`;

        try {
            const response = await this.callAI(userId, prompt);
            return this.extractJSON(response);
        } catch (error) {
            console.error('[PlatformContent] Reel generation error:', error.message);
            throw error;
        }
    }

    /**
     * Generate content for all platforms
     * @param {object} brief - Content brief
     * @param {array} userAnswers - User Q&A
     * @param {string} userId - User ID
     * @returns {Promise<object>} All platform content
     */
    async generateAllPlatformContent(brief, userAnswers, userId) {
        try {
            console.log('[PlatformContent] Generating content for all platforms');

            // Get user niche
            const { niche: userNiche } = await this.getUserIntegration(userId);

            // Generate all platforms in parallel with error handling per platform
            const results = await Promise.allSettled([
                this.generateLinkedInContent(brief, userAnswers, userId, userNiche),
                this.generateTwitterContent(brief, userAnswers, userId, userNiche),
                this.generateBlogContent(brief, userAnswers, userId, userNiche),
                this.generateReelScript(brief, userAnswers, userId, userNiche)
            ]);

            return {
                linkedin: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason?.message },
                twitter: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason?.message },
                blog: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason?.message },
                reelScript: results[3].status === 'fulfilled' ? results[3].value : { error: results[3].reason?.message }
            };
        } catch (error) {
            console.error('[PlatformContent] Error generating all platform content:', error.message);
            throw error;
        }
    }

    /**
     * Get metadata for platform content
     * @param {string} platform - Platform name
     * @param {object} content - Content object
     * @returns {object} Metadata
     */
    getMetadata(platform, content) {
        const metadata = {
            platform,
            generatedAt: new Date().toISOString()
        };

        try {
            if (platform === 'linkedin') {
                const fullPost = `${content.post.hook}\n\n${content.post.body}\n\n${content.post.cta}\n\n${content.post.hashtags.join(' ')}`;
                metadata.characterCount = fullPost.length;
                metadata.wordCount = fullPost.split(/\s+/).length;
            } else if (platform === 'twitter') {
                metadata.threadLength = content.thread?.length || 0;
                metadata.totalCharacters = content.thread?.reduce((sum, tweet) => sum + tweet.content.length, 0) || 0;
            } else if (platform === 'blog') {
                const fullArticle = `${content.article.introduction} ${content.article.sections.map(s => s.content).join(' ')} ${content.article.conclusion}`;
                metadata.wordCount = fullArticle.split(/\s+/).length;
                metadata.sectionCount = content.article.sections?.length || 0;
            } else if (platform === 'reelScript') {
                metadata.duration = content.production?.totalDuration || 'unknown';
                metadata.sceneCount = content.script?.body?.length || 0;
            }
        } catch (error) {
            console.error('[PlatformContent] Error calculating metadata:', error.message);
        }

        return metadata;
    }
}

module.exports = new PlatformContentService();
