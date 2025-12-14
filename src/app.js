// src/app.js

const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });

});

app.use('/api', routes);

app.use((err, req, res, next) => {
    console.error(err);
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
        error: err.message || 'Internal Server Error'
    });
});

module.exports = app;
