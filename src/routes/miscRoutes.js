const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/emailService');

router.post('/invite', async (req, res) => {
    try {
        // Updated to use the new waitlist fields from the frontend
        const { firstName, lastName, email, company, teamSize } = req.body;

        if (!firstName || !lastName || !email) {
            return res.status(400).json({ error: 'First Name, Last Name, and Email are required.' });
        }

        const subject = `New Enterprise Early Access Request: ${company || firstName}`;
        const html = `
            <h2>New Early Access Request (ContentPipeline Studio)</h2>
            <p><strong>First Name:</strong> ${firstName}</p>
            <p><strong>Last Name:</strong> ${lastName}</p>
            <p><strong>Work Email:</strong> ${email}</p>
            <p><strong>Company Name:</strong> ${company || 'N/A'}</p>
            <p><strong>Team Size:</strong> ${teamSize || 'N/A'}</p>
        `;

        await sendEmail({
            to: 'harrysingh1731@gmail.com',
            subject,
            html
        });

        res.status(200).json({ message: 'Invite request sent successfully!' });
    } catch (error) {
        console.error('Error sending invite request in miscRoutes.js:', error);
        res.status(500).json({ error: error.message || 'Failed to send invite request.' });
    }
});

module.exports = router;
