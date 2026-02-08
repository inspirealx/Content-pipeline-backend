// src/services/scraperService.js
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const googleTrends = require('google-trends-api');

class ScraperService {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.requestDelay = 1000; // 1 second delay between requests
    }

    /**
     * Helper method to add delay between requests
     * @param {number} ms - Milliseconds to delay
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Scrape Reddit discussions using public JSON API
     * @param {string} query - Search query
     * @param {object} options - Search options
     * @returns {Promise<object>} Reddit data
     */
    async scrapeReddit(query, options = {}) {
        const {
            subreddits = ['all'],
            timeFilter = 'month',
            limit = 50,
            sortBy = 'relevance'
        } = options;

        try {
            const subreddit = subreddits.join('+');
            const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=${sortBy}&t=${timeFilter}&limit=${limit}`;

            console.log(`[ScraperService] Fetching Reddit: ${url}`);

            const response = await fetch(url, {
                headers: { 'User-Agent': this.userAgent }
            });

            if (!response.ok) {
                console.error(`[ScraperService] Reddit API error: ${response.status}`);
                return { posts: [], totalFound: 0, query, timestamp: new Date().toISOString() };
            }

            const data = await response.json();
            const posts = [];

            if (data.data && data.data.children) {
                for (const child of data.data.children.slice(0, 10)) {
                    const post = child.data;

                    // Fetch comments for this post
                    await this.delay(this.requestDelay);
                    const comments = await this.fetchRedditComments(post.permalink);

                    posts.push({
                        title: post.title,
                        content: post.selftext,
                        score: post.score,
                        numComments: post.num_comments,
                        url: `https://www.reddit.com${post.permalink}`,
                        subreddit: post.subreddit,
                        created: new Date(post.created_utc * 1000).toISOString(),
                        comments: comments.slice(0, 5) // Top 5 comments
                    });
                }
            }

            return {
                posts,
                totalFound: data.data?.children?.length || 0,
                query,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ScraperService] Reddit scraping error:', error.message);
            return { posts: [], totalFound: 0, query, timestamp: new Date().toISOString(), error: error.message };
        }
    }

    /**
     * Fetch comments for a Reddit post
     * @param {string} permalink - Post permalink
     * @returns {Promise<array>} Array of comments
     */
    async fetchRedditComments(permalink) {
        try {
            const url = `https://www.reddit.com${permalink}.json?limit=20&sort=top`;
            const response = await fetch(url, {
                headers: { 'User-Agent': this.userAgent }
            });

            if (!response.ok) return [];

            const data = await response.json();
            const comments = [];

            if (data[1] && data[1].data && data[1].data.children) {
                for (const child of data[1].data.children) {
                    if (child.data && child.data.body) {
                        comments.push({
                            body: child.data.body,
                            score: child.data.score,
                            author: child.data.author
                        });
                    }
                }
            }

            return comments;
        } catch (error) {
            console.error('[ScraperService] Error fetching Reddit comments:', error.message);
            return [];
        }
    }

    /**
     * Get Google Trends data
     * @param {array} keywords - Array of keywords
     * @param {object} options - Trends options
     * @returns {Promise<object>} Trends data
     */
    async getGoogleTrends(keywords, options = {}) {
        const {
            timeRange = 'today 3-m',
            geo = 'US'
        } = options;

        const keyword = Array.isArray(keywords) ? keywords[0] : keywords;

        try {
            console.log(`[ScraperService] Fetching Google Trends for: ${keyword}`);

            // Get interest over time
            const interestOverTimeRaw = await googleTrends.interestOverTime({
                keyword,
                startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 3 months ago
                geo
            });
            const interestOverTime = JSON.parse(interestOverTimeRaw);

            await this.delay(this.requestDelay);

            // Get related queries
            const relatedQueriesRaw = await googleTrends.relatedQueries({
                keyword,
                geo
            });
            const relatedQueries = JSON.parse(relatedQueriesRaw);

            await this.delay(this.requestDelay);

            // Get related topics
            let relatedTopics = { default: { rankedList: [] }, rising: { rankedList: [] } };
            try {
                const relatedTopicsRaw = await googleTrends.relatedTopics({
                    keyword,
                    geo
                });
                relatedTopics = JSON.parse(relatedTopicsRaw);
            } catch (error) {
                console.warn('[ScraperService] Related topics not available');
            }

            return {
                interestOverTime: interestOverTime.default?.timelineData || [],
                relatedQueries: relatedQueries.default?.rankedList || [],
                risingQueries: relatedQueries.rising?.rankedList || [],
                risingTopics: relatedTopics.rising?.rankedList || [],
                keyword,
                geo,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ScraperService] Google Trends error:', error.message);

            // Fallback: Try to use RSS feed
            try {
                console.log('[ScraperService] Trying RSS fallback');
                const rssUrl = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;
                const response = await fetch(rssUrl);
                const rssData = await response.text();

                return {
                    interestOverTime: [],
                    relatedQueries: [],
                    risingQueries: [],
                    risingTopics: [],
                    rssData: rssData.substring(0, 500), // Just a snippet
                    keyword,
                    geo,
                    timestamp: new Date().toISOString(),
                    fallback: true
                };
            } catch (fallbackError) {
                console.error('[ScraperService] RSS fallback also failed');
                return {
                    interestOverTime: [],
                    relatedQueries: [],
                    risingQueries: [],
                    risingTopics: [],
                    keyword,
                    geo,
                    timestamp: new Date().toISOString(),
                    error: error.message
                };
            }
        }
    }

    /**
     * Scrape Google Search results
     * @param {string} query - Search query
     * @param {object} options - Search options
     * @returns {Promise<object>} Search results
     */
    async scrapeGoogleSearch(query, options = {}) {
        const { numResults = 30 } = options;

        try {
            console.log(`[ScraperService] Scraping Google Search for: ${query}`);

            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${numResults}`;
            const response = await fetch(url, {
                headers: { 'User-Agent': this.userAgent }
            });

            if (!response.ok) {
                console.error(`[ScraperService] Google Search error: ${response.status}`);
                return { organic: [], peopleAlsoAsk: [], relatedSearches: [], query, timestamp: new Date().toISOString() };
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Parse organic results
            const organic = [];
            $('.g').each((i, elem) => {
                const title = $(elem).find('h3').text();
                const link = $(elem).find('a').attr('href');
                const snippet = $(elem).find('.VwiC3b').text() || $(elem).find('.IsZvec').text();

                if (title && link) {
                    organic.push({ title, link, snippet });
                }
            });

            // Parse People Also Ask
            const peopleAlsoAsk = [];
            $('.related-question-pair, .kno-ftr, [data-q]').each((i, elem) => {
                const question = $(elem).text().trim();
                if (question && question.includes('?')) {
                    peopleAlsoAsk.push(question);
                }
            });

            // Parse Related Searches
            const relatedSearches = [];
            $('.k8XOCe, .s75CSd').each((i, elem) => {
                const term = $(elem).text().trim();
                if (term) {
                    relatedSearches.push(term);
                }
            });

            // Parse Featured Snippets
            const featuredSnippets = [];
            $('.IZ6rdc, .kp-blk').each((i, elem) => {
                const snippet = $(elem).text().trim();
                if (snippet) {
                    featuredSnippets.push(snippet.substring(0, 200));
                }
            });

            return {
                organic: organic.slice(0, 10),
                peopleAlsoAsk: [...new Set(peopleAlsoAsk)].slice(0, 5),
                relatedSearches: [...new Set(relatedSearches)].slice(0, 8),
                featuredSnippets: featuredSnippets.slice(0, 2),
                query,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ScraperService] Google Search scraping error:', error.message);
            return {
                organic: [],
                peopleAlsoAsk: [],
                relatedSearches: [],
                featuredSnippets: [],
                query,
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    // Legacy methods for backward compatibility
    async scrapeURL(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : 'Untitled';
            const contentMatch = html.match(/<body[^>]*>(.*?)<\/body>/is);
            let content = contentMatch ? contentMatch[1] : html;
            content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 2000);
            return { title, content };
        } catch (error) {
            throw new Error('Failed to scrape URL: ' + error.message);
        }
    }

    async parseRSSFeed(feedUrl) {
        try {
            const response = await fetch(feedUrl);
            const xml = await response.text();
            const items = [];
            const itemRegex = /<item>(.*?)<\/item>/gs;
            let match;
            while ((match = itemRegex.exec(xml)) !== null) {
                const item = match[1];
                const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
                const description = item.match(/<description>(.*?)<\/description>/)?.[1] || '';
                items.push({
                    title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
                    description: description.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
                });
            }
            return items.slice(0, 5);
        } catch (error) {
            throw new Error('Failed to parse RSS feed: ' + error.message);
        }
    }
}

module.exports = new ScraperService();