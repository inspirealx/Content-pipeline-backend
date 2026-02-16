// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const config = require('../config/env');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // Fallback to query parameter for OAuth redirects/popups
    if (!token && req.query.token) {
        token = req.query.token;
    }

    // Also check for access_token query param (alternative OAuth convention)
    if (!token && req.query.access_token) {
        token = req.query.access_token;
    }

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, config.jwtSecret, (err, user) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        req.user = user; // { userId, email }
        req.userId = user.userId; // For convenience in routes
        next();
    });
}

module.exports = { authenticateToken };