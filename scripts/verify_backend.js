// scripts/verify_backend.js
const { encrypt, decrypt } = require('../src/utils/encryption');
const { processInput } = require('../src/services/contentService');
// Mocking prisma for isolated test if possible, or just testing pure functions.

async function verify() {
    console.log('Starting Verification...\n');

    // 1. Test Encryption
    try {
        console.log('1. Testing Encryption Utils...');
        const originalText = 'super-secret-api-key';
        const encrypted = encrypt(originalText);
        const decrypted = decrypt(encrypted);

        if (originalText === decrypted && encrypted !== originalText) {
            console.log('✅ Encryption/Decryption Success');
        } else {
            console.error('❌ Encryption Failed');
        }
    } catch (e) {
        console.error('❌ Encryption Error:', e.message);
    }

    // 2. Test Content Processing (Topic)
    try {
        console.log('\n2. Testing Content Service (Topic Processing)...');
        const result = await processInput('topic', 'AI in Healthcare');
        if (result.title === 'AI in Healthcare' && result.content === 'AI in Healthcare') {
            console.log('✅ Topic Processing Success');
        } else {
            console.error('❌ Topic Processing Failed');
        }
    } catch (e) {
        console.error('❌ Content Service Error:', e.message);
    }

    // 3. Test Scraper (Optional - requires network)
    /*
    try {
        console.log('\n3. Testing Scraper...');
        const res = await processInput('url', 'https://example.com');
        if (res.title.includes('Example Domain')) {
             console.log('✅ Scraper Success');
        } else {
             console.log('⚠️ Scraper Warning: Title mismatch or network issue');
        }
    } catch (e) {
        console.log('⚠️ Scraper Skipped/Failed:', e.message);
    }
    */

    console.log('\nVerification Complete.');
}

verify();
