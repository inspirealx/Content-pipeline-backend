// src/controllers/authController.js

const authService = require('../services/authService');

async function register(req,res,next) {
    try {
        const { email,password } = req.body;
        const user = await authService.register(email,password);
        res.status(201).json({user});
    }catch(error) {
        next(error);
    }
}

async function login(req,res,next) {
    try {
        const {email,password} = req.body;
        const data = await authService.login(email,password);
        res.json(data);
    }catch(err){
        next(err);
    }
}

module.exports = {register,login};