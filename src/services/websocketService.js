// src/services/websocketService.js
const WebSocket = require('ws');

let wss = null;
const clients = new Map(); // userId -> WebSocket connection

function initializeWebSocket(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        console.log('WebSocket client connected');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                if (data.type === 'authenticate') {
                    // Store userId -> ws mapping
                    clients.set(data.userId, ws);
                    ws.userId = data.userId;
                    ws.send(JSON.stringify({ type: 'authenticated' }));
                    console.log(`User ${data.userId} authenticated via WebSocket`);
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        });

        ws.on('close', () => {
            if (ws.userId) {
                clients.delete(ws.userId);
                console.log(`User ${ws.userId} disconnected from WebSocket`);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    console.log('WebSocket server initialized');
}

function sendToUser(userId, message) {
    const ws = clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
    }
    return false;
}

function broadcastPublishUpdate(userId, publishJob) {
    const sent = sendToUser(userId, {
        type: 'PUBLISH_UPDATE',
        data: publishJob
    });

    if (sent) {
        console.log(`Sent publish update to user ${userId}: ${publishJob.status}`);
    }
}

function broadcastContentUpdate(userId, content) {
    sendToUser(userId, {
        type: 'CONTENT_UPDATE',
        data: content
    });
}

function broadcastVideoUpdate(userId, videoJob) {
    sendToUser(userId, {
        type: 'VIDEO_UPDATE',
        data: videoJob
    });
}

module.exports = {
    initializeWebSocket,
    broadcastPublishUpdate,
    broadcastContentUpdate,
    broadcastVideoUpdate
};
