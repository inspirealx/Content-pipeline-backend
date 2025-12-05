// src/server.js

const app = require('./app');
const config = require('./config/env');

app.listen(config.port, () => {
    console.log(`Server runnning on the PORT ${config.port}`);
    
});