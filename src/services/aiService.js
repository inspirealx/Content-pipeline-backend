// src/services/aiService.js
const fetch = require('node-fetch');
const config = require('../config/env');

async function callGeminiAPI(prompt, apiKey) {
    // Implement Gemini API call
    // Use Google AI Studio API
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API Error: ${err}`);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) return '';

    return data.candidates[0].content.parts[0].text;
}

async function callOpenAIAPI(prompt, apiKey) {
    // Implement OpenAI API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API Error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

module.exports = { callGeminiAPI, callOpenAIAPI };