// src/config/env.js
const dotenv = require('dotenv');
dotenv.config();

const config = {
    port : process.env.PORT || 4000,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
}

module.exports = config;
