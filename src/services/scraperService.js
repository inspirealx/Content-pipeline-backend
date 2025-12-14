// src/services/scraperService.js
const fetch = require('node-fetch');

async function scrapeURL(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();

        // Extract title (simple regex or cheerio)
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : 'Untitled';

        // Extract main content (remove HTML tags)
        const contentMatch = html.match(/<body[^>]*>(.*?)<\/body>/is);
        let content = contentMatch ? contentMatch[1] : html;
        content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 2000);

        return { title, content };
    } catch (error) {
        throw new Error('Failed to scrape URL: ' + error.message);
    }
}

async function parseRSSFeed(feedUrl) {
    // Basic RSS parsing (or use 'rss-parser' npm package if available)
    try {
        const response = await fetch(feedUrl);
        const xml = await response.text();

        // Extract items (simplified - use proper XML parser in production like xml2js or rss-parser)
        const items = [];
        const itemRegex = /<item>(.*?)<\/item>/gs;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const item = match[1];
            const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const description = item.match(/<description>(.*?)<\/description>/)?.[1] || '';
            // Decode HTML entities if needed? 
            items.push({
                title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
                description: description.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
            });
        }

        return items.slice(0, 5); // Return first 5 items
    } catch (error) {
        throw new Error('Failed to parse RSS feed: ' + error.message);
    }
}

module.exports = { scrapeURL, parseRSSFeed };