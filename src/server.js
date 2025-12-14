// src/server.js
const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { initializeWebSocket } = require('./services/websocketService');

const server = http.createServer(app);

// Initialize WebSocket
initializeWebSocket(server);

server.listen(config.port, () => {
    console.log(`🚀 Server running on PORT ${config.port}`);
    console.log(`📡 WebSocket server running`);
});