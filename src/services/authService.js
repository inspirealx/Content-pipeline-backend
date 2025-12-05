// src/services/authService.js
const prisma = require('../db/prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

async function register(email,password){
    const existing = await prisma.user.findUnique({where: {email}});
    if(existing) {
        const err = new Error('Email already registered');
        err.status = 400;
        throw err;
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
        const err = new Error('Invaid email or password');
        err.status = 401;
        throw err;

    }
    const isValid = await bcrypt.compare(password,user.passwordHash);
    if(!isValid){
        const err = new Error('Invalid email or password');
        err.status = 401;
        throw err;
    }

    const token = jwt.sign({
        userId: user.id,email:user.email},
        config.jwtSecret,
        {expireIn: '7d'}
    );

    return {
        token,
        user: {id:user.id,email:user.email},
    };
}

module.exports = {register,login};