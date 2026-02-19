const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/emailService');

router.post('/invite', async (req, res) => {
    try {
        const { name, email, phone, company, details } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and Email are required.' });
        }

        const subject = `New Invite Request from ${name}`;
        const html = `
            <h2>New Invite Request</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
            <p><strong>Company:</strong> ${company || 'N/A'}</p>
            <p><strong>Details:</strong></p>
            <p>${details || 'N/A'}</p>
        `;

        await sendEmail({
            to: 'contact@inspireal.in',
            subject,
            html
        });

        res.status(200).json({ message: 'Invite request sent successfully!' });
    } catch (error) {
        console.error('Error sending invite request:', error);
        res.status(500).json({ error: 'Failed to send invite request.' });
    }
});

module.exports = router;
