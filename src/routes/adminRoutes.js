// src/routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');
const prisma = require('../db/prismaClient');

// GET /api/admin/users - List all users
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/users/:userId/role - Update user role
router.patch('/users/:userId/role', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        // Validate role against Prisma enum
        if (!['USER', 'TESTER', 'ADMIN'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Update user role
        await prisma.user.update({
            where: { id: userId },
            data: { role }
        });

        res.json({
            success: true,
            message: `User role updated to ${role}`
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
