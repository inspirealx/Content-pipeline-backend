// src/services/authService.js
const prisma = require('../db/prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

async function register(email,password){
    const existing = await prisma.user.findUnique({where: {email}});
    if(existing) {
        throw new ApiError(
            'Email already exists in database',
            409,
            'EMAIL_EXISTS',
            'This email is already registered. Please sign in instead.',
            'email'
        );
    }

    const passwordHash = await bcrypt.hash(password,10);

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash
        }
    });

    return {id: user.id, email: user.email};

}

async function login(email,password){
    const user = await prisma.user.findUnique({where: {email}});
    if(!user){
        throw new ApiError(
            'Invalid credentials',
            401,
            'INVALID_CREDENTIALS',
            'Invalid email or password. Please check and try again.',
            'email'
        );
    }
    const isValid = await bcrypt.compare(password,user.passwordHash);
    if(!isValid){
        throw new ApiError(
            'Invalid credentials',
            401,
            'INVALID_CREDENTIALS',
            'Invalid email or password. Please check and try again.',
            'password'
        );
    }

    const token = jwt.sign({
        userId: user.id,email:user.email},
        config.jwtSecret,
        {expiresIn: '7d'}
    );

    return {
        token,
        user: {id:user.id,email:user.email},
    };
}

module.exports = {register,login};