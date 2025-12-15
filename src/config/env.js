// src/config/env.js
const dotenv = require('dotenv');
dotenv.config();

const config = {
    port: process.env.PORT || 4000,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    baseUrl: process.env.BASE_URL || 'http://localhost:4000'
}

module.exports = config;
