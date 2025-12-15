// src/app.js

const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');

const app = express();
const session = require('express-session');
const passport = require('passport');
const oauthRoutes = require('./routes/oauthRoutes');

// Session middleware for OAuth
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', oauthRoutes);
app.use('/api', routes);

app.use((err, req, res, next) => {
    console.error(err);
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
        error: err.message || 'Internal Server Error'
    });
});

module.exports = app;
