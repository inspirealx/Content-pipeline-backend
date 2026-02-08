// src/services/emailService.js
const nodemailer = require('nodemailer');
const config = require('../config/env');

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' or configure host/port manually
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send an email
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @returns {Promise<void>}
 */
const sendEmail = async ({ to, subject, html }) => {
    try {
        // If no credentials, just log it (for development without creds)
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log('⚠️ No email credentials found in environment variables (EMAIL_USER, EMAIL_PASS).');
            console.log('📝 Simulated Email Sending:');
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(`Body: ${html}`);
            return;
        }

        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER, // sender address
            to, // list of receivers
            subject, // Subject line
            html, // html body
        });

        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
        throw new Error("Failed to send email");
    }
};

module.exports = {
    sendEmail
};
