// test-topic-analysis.js - Test script for topic analysis
require('dotenv').config();
const scraperService = require('./src/services/scraperService');

async function testScrapers() {
    console.log('=== Testing Scrapers ===\n');

    // Test Reddit
    console.log('1. Testing Reddit Scraper...');
    try {
        const redditData = await scraperService.scrapeReddit('AI automation', {
            timeFilter: 'month',
            limit: 10
        });
        console.log(`✓ Reddit: Found ${redditData.posts.length} posts`);
        if (redditData.posts.length > 0) {
            console.log(`  Sample: "${redditData.posts[0].title}"`);
        }
    } catch (error) {
        console.error('✗ Reddit error:', error.message);
    }

    console.log('');

    // Test Google Trends
    console.log('2. Testing Google Trends...');
    try {
        const trendsData = await scraperService.getGoogleTrends(['AI automation']);
        console.log(`✓ Trends: Status = ${trendsData.fallback ? 'fallback' : 'success'}`);
        console.log(`  Related queries: ${trendsData.relatedQueries.length}`);
    } catch (error) {
        console.error('✗ Trends error:', error.message);
    }

    console.log('');

    // Test Google Search
    console.log('3. Testing Google Search...');
    try {
        const searchData = await scraperService.scrapeGoogleSearch('AI automation benefits');
        console.log(`✓ Search: Found ${searchData.organic.length} results`);
        console.log(`  People also ask: ${searchData.peopleAlsoAsk.length} questions`);
        if (searchData.peopleAlsoAsk.length > 0) {
            console.log(`  Sample: "${searchData.peopleAlsoAsk[0]}"`);
        }
    } catch (error) {
        console.error('✗ Search error:', error.message);
    }
}

async function main() {
    console.log('\n🚀 Topic Analysis Service Test\n');
    console.log('This will test data scraping from Reddit, Google Trends, and Google Search.\n');

    await testScrapers();

    console.log('\n💡 Full Topic Analysis Test:');
    console.log('To test the complete flow with AI integration:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Use the frontend or API to create a content session');
    console.log('3. The system will automatically run topic analysis\n');

    console.log('✅ Scraper test complete!\n');
    process.exit(0);
}

main().catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});
