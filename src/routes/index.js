// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');


router.use('/auth', userRoutes);


module.exports = router;