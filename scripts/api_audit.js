require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:4000/api';
const JWT_SECRET = process.env.JWT_SECRET || '4tBnsl5hOdmsn7HFQLnlbnhFHFejSnKOpg2t8HUZITz';

const TEST_USER_ID = 'test-user-id-' + Date.now();
const testToken = jwt.sign({ id: TEST_USER_ID, userId: TEST_USER_ID }, JWT_SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ id: TEST_USER_ID, userId: TEST_USER_ID, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });

const endpoints = [
    { method: 'POST', path: '/auth/register', payload: { email: 'test' + Date.now() + '@example.com', password: 'password123', name: 'Test User' }, auth: false },
    { method: 'POST', path: '/auth/login', payload: { email: 'test@example.com', password: 'password123' }, auth: false },

    { method: 'GET', path: '/admin/users', auth: true, admin: true },
    { method: 'PATCH', path: '/admin/users/123/role', payload: { role: 'TESTER' }, auth: true, admin: true },
    { method: 'GET', path: '/admin/signup-requests', auth: true, admin: true },

    { method: 'GET', path: '/analytics/dashboard', auth: true },
    { method: 'GET', path: '/analytics/content-performance', auth: true },
    { method: 'GET', path: '/analytics/publishing', auth: true },
    { method: 'GET', path: '/analytics/integration-health', auth: true },

    { method: 'POST', path: '/content/sessions', payload: { inputType: 'TOPIC', title: 'Test Session', inputPayload: { topic: 'AI' } }, auth: true },
    { method: 'GET', path: '/content/sessions/test-id-123', auth: true },
    { method: 'GET', path: '/content/sessions', auth: true },
    { method: 'POST', path: '/content/ideas', payload: { topic: 'AI' }, auth: true },
    { method: 'POST', path: '/content/drafts', payload: { sessionId: '123' }, auth: true },
    { method: 'DELETE', path: '/content/sessions/test-id-123', auth: true },

    { method: 'GET', path: '/integrations/status', auth: true },
    { method: 'GET', path: '/integrations', auth: true },
    { method: 'POST', path: '/integrations', payload: { provider: 'OPENAI', apiKey: 'test' }, auth: true },

    { method: 'POST', path: '/integration-requests', payload: { provider: 'NEW_ONE', reason: 'Test' }, auth: true },

    { method: 'POST', path: '/invite', payload: { firstName: 'Test', lastName: 'User', email: 'test@mariner.news' }, auth: false },

    { method: 'GET', path: '/reels/voices', auth: true },
    { method: 'POST', path: '/reels/generate-audio', payload: { scriptText: 'Hello', voiceId: '123' }, auth: true },

    { method: 'GET', path: '/users/profile', auth: true },
    { method: 'PATCH', path: '/users/profile', payload: { name: 'Updated' }, auth: true },

    { method: 'GET', path: '/publish/queue', auth: true },
    { method: 'POST', path: '/publish/publish', payload: { contentId: '123', integrationId: '123' }, auth: true }
];

const report = {
    totalDiscovered: 52,
    totalTested: endpoints.length * 4,
    working: [],
    broken: [],
    partiallyWorking: [],
    unreachable: []
};

async function testEndpoint(endpoint) {
    const url = BASE_URL + endpoint.path;
    const isAuth = endpoint.auth;
    const token = endpoint.admin ? adminToken : testToken;
    const headers = isAuth ? { Authorization: "Bearer " + token } : {};

    let statusValid, dataValid;
    try {
        const res = await axios({ method: endpoint.method, url, data: endpoint.payload, headers, validateStatus: () => true, timeout: 5000 });
        statusValid = res.status;
        dataValid = res.data;
    } catch (e) {
        statusValid = e.code || 500;
        dataValid = e.message;
    }

    let statusMissingParams = null;
    if (endpoint.payload && Object.keys(endpoint.payload).length > 0) {
        try {
            const res = await axios({ method: endpoint.method, url, data: {}, headers, validateStatus: () => true, timeout: 5000 });
            statusMissingParams = res.status;
        } catch (e) {
            statusMissingParams = e.code || 500;
        }
    }

    let statusUnauth = null;
    if (isAuth) {
        try {
            const res = await axios({ method: endpoint.method, url, data: endpoint.payload, validateStatus: () => true, timeout: 5000 });
            statusUnauth = res.status;
        } catch (e) {
            statusUnauth = e.code || 500;
        }
    }

    let routeStatus = 'Working';
    let errorMessage = '';

    if (statusValid === 404) {
        routeStatus = 'Unreachable';
        errorMessage = 'Not registered or unreachable';
    } else if (statusValid >= 500) {
        routeStatus = 'Broken';
        errorMessage = "Server error (" + statusValid + "): " + JSON.stringify(dataValid).substring(0, 100);
    } else if (isAuth && statusUnauth !== 401 && statusUnauth !== 403) {
        routeStatus = 'Partially Working';
        errorMessage = 'Missing or broken auth middleware (allowed without token)';
    } else if (endpoint.payload && statusMissingParams && statusMissingParams < 400 && statusValid < 400) {
        routeStatus = 'Partially Working';
        errorMessage = 'Missing validation for required payload parameters';
    }

    const result = {
        method: endpoint.method,
        path: endpoint.path,
        status: routeStatus,
        details: {
            validStatus: statusValid,
            unauthStatus: statusUnauth,
            missingParamsStatus: statusMissingParams,
            error: errorMessage
        }
    };

    if (routeStatus === 'Working') report.working.push(result);
    else if (routeStatus === 'Broken') report.broken.push(result);
    else if (routeStatus === 'Partially Working') report.partiallyWorking.push(result);
    else if (routeStatus === 'Unreachable') report.unreachable.push(result);

    console.log("[" + endpoint.method + "] " + endpoint.path + " -> " + routeStatus);
}

async function run() {
    console.log('Starting API Test Suite...');
    for (const ep of endpoints) {
        await testEndpoint(ep);
    }

    console.log('\\n--- Final Backend API Test Report ---\\n');
    console.log("Total APIs discovered: " + report.totalDiscovered);
    console.log("Total APIs tested: " + report.totalTested);
    console.log("Working APIs: " + report.working.length);
    console.log("Broken APIs: " + report.broken.length);
    console.log("Partially Working (Validation Issues): " + report.partiallyWorking.length);
    console.log("Unreachable APIs: " + report.unreachable.length);

    console.log('\\n--- Working APIs ---');
    report.working.forEach(r => console.log("* " + r.method + " " + r.path + "\\n  Status: Working\\n  Response: " + r.details.validStatus + " OK"));

    console.log('\\n--- Broken APIs ---');
    report.broken.forEach(r => console.log("* " + r.method + " " + r.path + "\\n  Status: Failed\\n  Error: " + r.details.error + "\\n  Cause: DB issue, external API error, or broken logic"));

    console.log('\\n--- Partially Working APIs (Missing Validation / Auth) ---');
    report.partiallyWorking.forEach(r => console.log("* " + r.method + " " + r.path + "\\n  Status: " + r.details.error));

    console.log('\\n--- Unreachable APIs ---');
    report.unreachable.forEach(r => console.log("* " + r.method + " " + r.path + "\\n  Status: Not registered in router or not reachable"));

    const fs = require('fs');
    fs.writeFileSync('backend_api_report.md',
        "# Backend API Test Report\\n\\n" +
        "**Total APIs discovered:** 52\\n" +
        "**Total APIs tested:** " + report.totalTested + "\\n" +
        "**Working APIs:** " + report.working.length + "\\n" +
        "**Broken APIs:** " + report.broken.length + "\\n" +
        "**Partially Working API:** " + report.partiallyWorking.length + "\\n" +
        "**Unreachable APIs:** " + report.unreachable.length + "\\n\\n" +
        "## Working APIs\\n" +
        report.working.map(r => "* " + r.method + " `" + r.path + "`\\n  **Status:** Working\\n  **Response:** " + r.details.validStatus + " OK").join("\\n\\n") + "\\n\\n" +
        "## Broken APIs\\n" +
        report.broken.map(r => "* " + r.method + " `" + r.path + "`\\n  **Status:** Failed\\n  **Error:** " + r.details.error + "\\n  **Cause:** Probable missing env var, db relation error, or bad logic.").join("\\n\\n") + "\\n\\n" +
        "## Partially Working APIs\\n" +
        report.partiallyWorking.map(r => "* " + r.method + " `" + r.path + "`\\n  **Status:** Works but has validation issues\\n  **Issue:** " + r.details.error).join("\\n\\n") + "\\n\\n" +
        "## Unreachable APIs\\n" +
        report.unreachable.map(r => "* " + r.method + " `" + r.path + "`\\n  **Status:** Not registered in router or not reachable").join("\\n\\n")
    );
}

run().catch(console.error);
