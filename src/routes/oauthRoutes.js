// src/routes/oauthRoutes.js
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const oauthService = require('../services/oauthService');
const oauthConfig = require('../config/oauth');

const router = express.Router();

// Passport configuration
passport.use(new GoogleStrategy(oauthConfig.google,
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await oauthService.findOrCreateUser('google', profile);
      done(null, { user, accessToken, refreshToken });
    } catch (error) {
      done(error, null);
    }
  }
));

passport.use(new GitHubStrategy(oauthConfig.github,
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await oauthService.findOrCreateUser('github', profile);
      done(null, { user, accessToken, refreshToken });
    } catch (error) {
      done(error, null);
    }
  }
));

// Serialize/deserialize for session (minimal use)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// OAuth initiation routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/github',
  passport.authenticate('github', { session: false })
);

// OAuth callback routes
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/signin?error=oauth_failed' }),
  async (req, res) => {
    try {
      const { user } = req.user;
      const token = oauthService.generateJWT(user);
      
      // Redirect to frontend with token (secure approach)
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&provider=google`;
      res.redirect(redirectUrl);
    } catch (error) {
      res.redirect('/signin?error=oauth_error');
    }
  }
);

router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/signin?error=oauth_failed' }),
  async (req, res) => {
    try {
      const { user } = req.user;
      const token = oauthService.generateJWT(user);
      
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&provider=github`;
      res.redirect(redirectUrl);
    } catch (error) {
      res.redirect('/signin?error=oauth_error');
    }
  }
);

module.exports = router;
