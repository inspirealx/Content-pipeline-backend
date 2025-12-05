// src/app.js

const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health',(req,res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString()});

});

app.use('/api',routes);

app.use((err,req,res,next) => {
    console.error(err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error'
    })
})

module.exports = app;
