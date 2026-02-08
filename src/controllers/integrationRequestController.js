// src/controllers/integrationRequestController.js
const { sendEmail } = require('../services/emailService');

const createRequest = async (req, res, next) => {
    try {
        const { platformName, platformType, useCase, priority, additionalDetails, userEmail } = req.body;

        // Basic validation
        if (!platformName || !platformType || !useCase || !priority || !userEmail) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        if (useCase.length < 50) {
            return res.status(400).json({
                success: false,
                message: 'Use Case must be at least 50 characters long'
            });
        }

        // Prepare email content
        const subject = `New Integration Request - ${platformName}`;
        const html = `
            <h2>New Integration Request</h2>
            <p><strong>Platform Name:</strong> ${platformName}</p>
            <p><strong>Platform Type:</strong> ${platformType}</p>
            <p><strong>Requested by:</strong> ${userEmail}</p>
            <p><strong>Priority:</strong> ${priority}</p>
            <p><strong>Use Case:</strong><br>${useCase}</p>
            <p><strong>Additional Details:</strong><br>${additionalDetails || 'N/A'}</p>
            <p><strong>Date Requested:</strong> ${new Date().toLocaleString()}</p>
        `;

        // Send email
        await sendEmail({
            to: 'contact@mariner.news',
            subject,
            html
        });

        res.status(201).json({
            success: true,
            message: 'Integration request submitted successfully'
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    createRequest
};
