// src/routes/integrationRoutes.js

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const integrationStatus = require('../config/integrationStatus');
const prisma = require('../db/prismaClient');

// GET /api/integrations/status
router.get('/status', authenticateToken, async (req, res) => {
    try {
        // Fetch latest user role from DB (in case it changed since login token issue)
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { role: true }
        });

        const userRole = user?.role || 'USER';

        // Filter integrations based on user role
        // Filter integrations based on user role and visibility
        const visibleIntegrations = Object.entries(integrationStatus)
            .filter(([key, integration]) =>
                // Check if user's role allows them to see this integration at all
                integration.visibleTo.includes(userRole)
            )
            .reduce((acc, [key, integration]) => {
                // Determine display status based on role
                let displayStatus = integration.status;

                // If user is just a USER and status is Beta, show as Coming Soon
                if (userRole === 'USER' && integration.status === 'beta') {
                    displayStatus = 'coming_soon';
                }

                // If disabled, maybe hide it? Or show as disabled. 
                // Config says visibleTo includes USER for disabled items usually?
                // We'll keep the logic simple: if it's visible, we show it, but override status if needed.

                acc[integration.category] = acc[integration.category] || [];
                acc[integration.category].push({
                    id: key,
                    ...integration,
                    status: displayStatus,
                    // If we downgraded to coming_soon, remove betaNote to avoid confusion
                    betaNote: (displayStatus === 'coming_soon') ? undefined : integration.betaNote
                });
                return acc;
            }, {
                ai_generation: [],
                publishing: [],
                ai_media: []
            });

        res.json({
            integrations: visibleIntegrations,
            userRole: userRole
        });
    } catch (error) {
        console.error('Error fetching integration status:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;