// src/config/socialOauth.js
const config = require('./env');

module.exports = {
    linkedin: {
        clientID: process.env.LINKEDIN_CLIENT_ID || '',
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
        callbackURL: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:4000/api/oauth/linkedin/callback',
        // Force library to use OpenID Connect userinfo endpoint (v2 API)
        profileURL: 'https://api.linkedin.com/v2/userinfo',
        scope: ['openid', 'profile', 'email', 'w_member_social', 'w_organization_social', 'r_organization_social', 'rw_organization_admin'],
        state: true
    },

    twitter: {
        clientID: process.env.TWITTER_CLIENT_ID || '',
        clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
        callbackURL: process.env.TWITTER_REDIRECT_URI || 'http://localhost:4000/api/oauth/twitter/callback',
        // OAuth 2.0 Scopes
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        // OAuth 2.0 Endpoints
        authorizationURL: 'https://twitter.com/i/oauth2/authorize',
        tokenURL: 'https://api.twitter.com/2/oauth2/token',
        userProfileURL: 'https://api.twitter.com/2/users/me',
        state: true
    },

    facebook: {
        clientID: process.env.FACEBOOK_APP_ID || '',
        clientSecret: process.env.FACEBOOK_APP_SECRET || '',
        callbackURL: process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:4000/api/oauth/facebook/callback',
        profileFields: ['id', 'emails', 'name'],
        scope: ['email', 'pages_manage_posts', 'pages_read_engagement'],
        enableProof: true
    }
};
