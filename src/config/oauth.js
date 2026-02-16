// src/config/oauth.js
const config = require('./env');

module.exports = {
  google: {
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    callbackURL: `${config.baseUrl}/api/oauth/google/callback`
  },
  github: {
    clientID: config.githubClientId,
    clientSecret: config.githubClientSecret,
    callbackURL: `${config.baseUrl}/api/oauth/github/callback`,
    scope: ['user:email']
  }
};
