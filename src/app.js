// src/app.js

const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');

const app = express();
const session = require('express-session');
const passport = require('passport');
const oauthRoutes = require('./routes/oauthRoutes');

// Trust proxy is required for OAuth to work correctly behind proxies/load balancers
// and for secure cookies to work if termination happens upstream
app.set('trust proxy', 1);

// Session middleware for OAuth
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: true, // Changed to true for better compatibility
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Only secure in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(passport.initialize());

app.use(cors());
app.use(express.json());

// Serve static files for generated audio
app.use('/generated-audio', express.static('public/generated-audio'));


app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);
app.use('/api/oauth', oauthRoutes);

app.use((err, req, res, next) => {
    // Log error with context
    console.error(`[${new Date().toISOString()}] Error:`, {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        userId: req.user?.id,
        sessionID: req.sessionID,
        hasSession: !!req.session,
        statusCode: err.statusCode
    });

    const statusCode = err.statusCode || err.status || 500;

    // If it's an ApiError, use its toJSON method
    if (err.toJSON) {
        return res.status(statusCode).json(err.toJSON());
    }

    // Fallback for other errors
    res.status(statusCode).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: err.message || 'Internal Server Error',
            userMessage: 'An unexpected error occurred. Please try again.'
        }
    });
});

module.exports = app;
