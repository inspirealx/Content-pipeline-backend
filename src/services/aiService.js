// src/services/aiService.js
const axios = require('axios');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

async function callGemini(prompt, apiKey) {
    const response = await axios.post(`${GEMINI_API_URL}?key=${apiKey}`, {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    });

    let text = response.data.candidates[0].content.parts[0].text;
    // Clean the output: remove Markdown code blocks if present
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    return text.trim();
}

async function generateContentIdeas(prompt, apiKey) {
    const fullPrompt = `Generate 5 creative content ideas based on the following input: ${prompt}. Return them as a JSON array of objects with 'title' and 'description' fields.`;
    const response = await callGemini(fullPrompt, apiKey);
    // Assume response is JSON string
    return JSON.parse(response);
}

async function generateQuestions(ideaContext, apiKey) {
    const fullPrompt = `Based on this content idea: "${ideaContext}", generate 5 clarifying questions to help refine the idea. Return as a JSON array of strings.`;
    const response = await callGemini(fullPrompt, apiKey);
    return JSON.parse(response);
}

async function generateFinalContent(context, platforms, apiKey) {
    const platformsStr = platforms.join(', ');
    const fullPrompt = `Based on the following context, generate content for the specified platforms. Context: ${JSON.stringify(context)}. Platforms: ${platformsStr}. Return a JSON object where keys are platform names and values are the content bodies. Ensure the output is valid JSON.`;
    const response = await callGemini(fullPrompt, apiKey);
    return JSON.parse(response);
}

module.exports = { generateContentIdeas, generateQuestions, generateFinalContent };