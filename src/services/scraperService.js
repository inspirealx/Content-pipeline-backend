// src/services/scraperService.js
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeUrl(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('title').text().trim();
        const body = $('body').text().trim(); // Extract main body text

        return { title, body };
    } catch (error) {
        throw new Error(`Failed to scrape URL: ${error.message}`);
    }
}

module.exports = { scrapeUrl };