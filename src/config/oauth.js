// src/config/oauth.js
const config = require('./env');

module.exports = {
  google: {
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    callbackURL: `${config.baseUrl}/auth/google/callback`
  },
  github: {
    clientID: config.githubClientId,
    clientSecret: config.githubClientSecret,
    callbackURL: `${config.baseUrl}/auth/github/callback`,
    scope: ['user:email']
  }
};
