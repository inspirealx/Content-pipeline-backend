// src/services/authService.js
const prisma = require('../db/prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

async function register(data) {
    const { password, fullName, companyName, companySize, industry, jobTitle, website, useCase } = data;
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new ApiError(
            'Email already exists in database',
            409,
            'EMAIL_EXISTS',
            'This email is already registered. Please sign in instead.',
            'email'
        );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            fullName,
            name: fullName,
            companyName,
            companySize,
            industry,
            jobTitle,
            website,
            useCase,
            approvalStatus: 'PENDING',
        }
    });

    return { id: user.id, email: user.email, status: 'pending' };
}

async function login(emailInput, password) {
    const email = emailInput.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new ApiError(
            'Invalid credentials',
            401,
            'INVALID_CREDENTIALS',
            'Invalid email or password. Please check and try again.',
            'email'
        );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        throw new ApiError(
            'Invalid credentials',
            401,
            'INVALID_CREDENTIALS',
            'Invalid email or password. Please check and try again.',
            'password'
        );
    }

    // Block sign in based on approval status (admins are always allowed)
    if (user.role !== 'ADMIN' && user.approvalStatus === 'PENDING') {
        throw new ApiError(
            'Account pending approval',
            403,
            'PENDING_APPROVAL',
            'Your account is awaiting admin approval. You will be notified once approved.',
            'email'
        );
    }

    if (user.approvalStatus === 'REJECTED') {
        throw new ApiError(
            'Account rejected',
            403,
            'ACCOUNT_REJECTED',
            'Your application was not approved. Please contact support for more information.',
            'email'
        );
    }

    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: '7d' }
    );

    return {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
}

module.exports = { register, login };