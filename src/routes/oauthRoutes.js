// src/routes/oauthRoutes.js
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const oauthService = require('../services/oauthService');
const integrationOauthService = require('../services/integrationOauthService');
const oauthConfig = require('../config/oauth');
const socialOauthConfig = require('../config/socialOauth');
const { authenticateToken } = require('../middleware/authMiddleware');
const axios = require('axios'); // Required for manual profile fetch

const router = express.Router();

// ========================================
// USER AUTHENTICATION STRATEGIES (Google, GitHub)
// ========================================

// Passport configuration for user login
passport.use('google-login', new GoogleStrategy(oauthConfig.google,
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await oauthService.findOrCreateUser('google', profile);
      done(null, { user, accessToken, refreshToken });
    } catch (error) {
      done(error, null);
    }
  }
));

passport.use('github-login', new GitHubStrategy(oauthConfig.github,
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await oauthService.findOrCreateUser('github', profile);
      done(null, { user, accessToken, refreshToken });
    } catch (error) {
      done(error, null);
    }
  }
));

// ========================================
// SOCIAL MEDIA PUBLISHING STRATEGIES (LinkedIn, Twitter, Facebook)
// ========================================

// LinkedIn Publishing OAuth
if (socialOauthConfig.linkedin.clientID) {
  const linkedinStrategy = new LinkedInStrategy(socialOauthConfig.linkedin,
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('\n========== LINKEDIN OAUTH DEBUG ==========');
        console.log('✅ Access Token received:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
        console.log('📝 Refresh Token:', refreshToken ? 'Present' : 'Not provided');
        console.log('👤 Profile Data:', JSON.stringify(profile, null, 2));
        console.log('📧 Email:', profile.emails?.[0]?.value || 'No email');
        console.log('🆔 Profile ID:', profile.id);
        console.log('📛 Display Name:', profile.displayName);
        console.log('==========================================\n');

        done(null, {
          profile,
          tokens: {
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
          }
        });
      } catch (error) {
        console.error('\n❌ LINKEDIN OAUTH ERROR:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        console.error('==========================================\n');
        done(error, null);
      }
    }
  );

  // OVERRIDE userProfile to supported API v2 (OpenID Connect)
  // The default library uses deprecated v1/v2 routes that fail
  linkedinStrategy.userProfile = async function (accessToken, done) {
    try {
      // Fetch basic profile and email via OpenID Connect userinfo endpoint
      const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const data = response.data;

      // Map OIDC response to Passport profile format
      const profile = {
        provider: 'linkedin',
        id: data.sub,
        displayName: data.name,
        name: {
          givenName: data.given_name,
          familyName: data.family_name
        },
        emails: [{ value: data.email }],
        photos: [{ value: data.picture }],
        _json: data
      };

      done(null, profile);
    } catch (error) {
      console.error('Error fetching LinkedIn profile:', error.response?.data || error.message);
      done(error);
    }
  };

  passport.use('linkedin-publishing', linkedinStrategy);
  console.log('✅ LinkedIn OAuth strategy configured successfully (with OIDC v2 override)');
} else {
  console.warn('⚠️  LinkedIn OAuth clientID missing. LinkedIn connection will be unavailable.');
}

// Twitter Publishing OAuth
/**
 * REPLACED WITH MANUAL IMPLEMENTATION BELOW due to session issues
 * 
// if (socialOauthConfig.twitter.clientID) {
//   passport.use('twitter-publishing', new TwitterStrategy({
//     consumerKey: socialOauthConfig.twitter.clientID,
//     consumerSecret: socialOauthConfig.twitter.clientSecret,
//     callbackURL: socialOauthConfig.twitter.callbackURL,
//     includeEmail: true,
//     passReqToCallback: true
//   },
//     async (req, token, tokenSecret, profile, done) => {
//       // ... (old implementation)
//     }
//   ));
// } else {
//   console.warn('Twitter OAuth clientID/consumerKey missing. Twitter connection will be unavailable.');
// }
*/

// Facebook Publishing OAuth
if (socialOauthConfig.facebook.clientID) {
  passport.use('facebook-publishing', new FacebookStrategy({
    clientID: socialOauthConfig.facebook.clientID,
    clientSecret: socialOauthConfig.facebook.clientSecret,
    callbackURL: socialOauthConfig.facebook.callbackURL,
    profileFields: socialOauthConfig.facebook.profileFields
  },
    async (accessToken, refreshToken, profile, done) => {
      try {
        done(null, {
          profile,
          tokens: {
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
          }
        });
      } catch (error) {
        done(error, null);
      }
    }
  ));
} else {
  console.warn('Facebook OAuth clientID missing. Facebook connection will be unavailable.');
}

// Serialize/deserialize for session (minimal use)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ========================================
// USER AUTHENTICATION ROUTES
// ========================================

// OAuth initiation routes for user login
router.get('/google',
  passport.authenticate('google-login', { scope: ['profile', 'email'], session: false })
);

router.get('/github',
  passport.authenticate('github-login', { session: false })
);

// OAuth callback routes for user login
router.get('/google/callback',
  passport.authenticate('google-login', { session: false, failureRedirect: '/signin?error=oauth_failed' }),
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
  passport.authenticate('github-login', { session: false, failureRedirect: '/signin?error=oauth_failed' }),
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

// ========================================
// SOCIAL MEDIA PUBLISHING OAUTH ROUTES
// ========================================

// LinkedIn Publishing OAuth
router.get('/linkedin/connect',
  authenticateToken,
  (req, res, next) => {
    if (!socialOauthConfig.linkedin.clientID) {
      return res.status(501).json({ error: 'LinkedIn OAuth not configured' });
    }

    // Store userId in state to retrieve after OAuth callback
    console.log('🔐 User authenticated for LinkedIn OAuth:', req.userId);
    req.session = req.session || {};
    req.session.linkedinOAuthUserId = req.userId;

    next();
  },
  passport.authenticate('linkedin-publishing', {
    session: false,
    // Pass userId as state parameter
    state: true
  })
);

// Custom callback wrapper to handle OAuth errors gracefully (prevent JSON response in popup)
router.get('/linkedin/callback',
  (req, res, next) => {
    passport.authenticate('linkedin-publishing', { session: false }, (err, user, info) => {
      if (err) {
        console.error('\n❌ LINKEDIN OAUTH FAILURE:', err);
        // Return HTML script to close popup and notify parent
        return res.send(`
          <script>
            window.opener.postMessage({ 
              type: 'oauth_error', 
              provider: 'linkedin', 
              error: '${(err.message || 'Authentication failed').replace(/'/g, "\\'")}' 
            }, '*');
            window.close();
          </script>
        `);
      }

      if (!user) {
        return res.send(`
          <script>
            window.opener.postMessage({ 
              type: 'oauth_error', 
              provider: 'linkedin', 
              error: 'No user data received' 
            }, '*');
            window.close();
          </script>
        `);
      }

      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    try {
      console.log('\n========== LINKEDIN CALLBACK DEBUG ==========');
      console.log('📥 Request User Object:', req.user ? 'Present' : 'MISSING');

      if (!req.user) {
        throw new Error('No user data received from LinkedIn OAuth');
      }

      const { profile, tokens } = req.user;
      console.log('👤 Profile from callback:', profile ? 'Present' : 'MISSING');
      console.log('🔑 Tokens from callback:', tokens ? 'Present' : 'MISSING');

      // Extract userId from session (stored during /connect route)
      const userId = req.session?.linkedinOAuthUserId;
      console.log('🆔 User ID from session:', userId);
      console.log('📦 Session data:', req.session);

      if (!userId) {
        console.error('❌ No userId found in session. This likely means:');
        console.error('   1. Session middleware not configured, OR');
        console.error('   2. User accessed callback directly without going through /connect');
        throw new Error('User authentication session lost. Please try connecting LinkedIn again.');
      }

      // Save integration to database
      console.log('💾 Saving integration to database...');
      await integrationOauthService.saveOAuthIntegration(userId, 'LINKEDIN', profile, tokens);
      console.log('✅ Integration saved successfully');

      // Clean up session
      delete req.session.linkedinOAuthUserId;
      console.log('============================================\n');

      // Close popup and notify parent window
      res.send(`
        <script>
          window.opener.postMessage({ type: 'oauth_success', provider: 'linkedin' }, '*');
          window.close();
        </script>
      `);
    } catch (error) {
      console.error('\n❌ LINKEDIN CALLBACK ERROR:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      res.send(`
        <script>
          window.opener.postMessage({ 
            type: 'oauth_error', 
            provider: 'linkedin', 
            error: '${error.message.replace(/'/g, "\\'")}' 
          }, '*');
          window.close();
        </script>
      `);
      return;
    }

    try {
      const { profile, tokens } = req.user;
      const userId = req.session?.linkedinOAuthUserId;

      if (!userId) {
        throw new Error('User authentication session lost. Please try connecting LinkedIn again.');
      }

      // 1. Save Personal Profile Integration (Master)
      console.log('💾 Saving Personal Profile integration...');
      const masterIntegration = await integrationOauthService.saveOAuthIntegration(userId, 'LINKEDIN', profile, tokens);
      console.log('✅ Personal Profile saved. ID:', masterIntegration.id);

      // 2. Fetch Company Pages (Organizations)
      console.log('🏢 Fetching LinkedIn Company Pages...');
      let pages = [];
      try {
        const pagesResponse = await axios.get('https://api.linkedin.com/v2/organizationalEntityAcls', {
          headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
          params: {
            q: 'roleAssignee',
            role: 'ADMINISTRATOR',
            state: 'APPROVED',
            projection: '(elements*(organizationalTarget~(name,logoV2(original~:playableStreams))))'
          }
        });

        // Transform response into usable page objects
        if (pagesResponse.data && pagesResponse.data.elements) {
          pages = pagesResponse.data.elements.map(element => {
            const org = element['organizationalTarget~'];
            if (!org) return null;

            let picture = null;
            if (org.logoV2 && org.logoV2['original~'] && org.logoV2['original~'].elements && org.logoV2['original~'].elements.length > 0) {
              picture = org.logoV2['original~'].elements[0].identifiers[0].identifier;
            }

            return {
              id: element.organizationalTarget, // URN format: urn:li:organization:123456
              name: org.name,
              picture: picture
            };
          }).filter(p => p !== null);
        }
        console.log(`✅ Found ${pages.length} admin pages.`);
      } catch (pageError) {
        console.error('⚠️ Failed to fetch Company Pages:', pageError.response?.data || pageError.message);
        // Don't fail the whole flow if pages fetch fails, just return empty list
      }

      // Clean up session
      delete req.session.linkedinOAuthUserId;

      // 3. Return Success + Pages to Frontend
      const responseData = {
        type: 'oauth_success',
        provider: 'linkedin',
        integrationId: masterIntegration.id, // Personal profile ID
        pages: pages // List of connectable pages
      };

      res.send(`
        <script>
          window.opener.postMessage(${JSON.stringify(responseData)}, '*');
          window.close();
        </script>
      `);

    } catch (error) {
      // ... existing error handler ...
      console.error('\n❌ LINKEDIN CALLBACK PROCESS ERROR:', error);
      res.send(`
        <script>
          window.opener.postMessage({ 
            type: 'oauth_error', 
            provider: 'linkedin', 
            error: '${error.message.replace(/'/g, "\\'")}' 
          }, '*');
          window.close();
        </script>
      `);
    }
  }
);

// ========================================
// MANUAL TWITTER OAUTH 2.0 IMPLEMENTATION (PKCE)
// ========================================
const crypto = require('crypto');

// In-memory store for PKCE verifiers (state -> { verifier, userId })
const twitterPcKeStore = new Map();

// Helper to generate PKCE Verifier and Challenge
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// Twitter Publishing OAuth Connect (OAuth 2.0)
router.get('/twitter/connect',
  authenticateToken,
  (req, res) => {
    if (!socialOauthConfig.twitter.clientID) {
      return res.status(501).json({ error: 'Twitter OAuth not configured' });
    }

    console.log('🔄 Starting Twitter OAuth 2.0 Flow (PKCE)...');

    const { verifier, challenge } = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');

    // Store verifier mapped to state
    twitterPcKeStore.set(state, {
      verifier,
      userId: req.userId
    });

    // Build Authorization URL
    const authUrl = new URL(socialOauthConfig.twitter.authorizationURL);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', socialOauthConfig.twitter.clientID);
    authUrl.searchParams.append('redirect_uri', socialOauthConfig.twitter.callbackURL);
    authUrl.searchParams.append('scope', socialOauthConfig.twitter.scope.join(' '));
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', challenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    console.log('➡️ Redirecting to Twitter...');
    res.redirect(authUrl.toString());
  }
);

router.get('/twitter/callback',
  async (req, res) => {
    try {
      console.log('\n========== TWITTER CALLBACK DEBUG (OAuth 2.0) ==========');

      const { code, state, error } = req.query;

      if (error) {
        throw new Error(`Twitter returned error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing code or state from Twitter callback');
      }

      // Retrieve stored verifier
      const storedData = twitterPcKeStore.get(state);
      if (!storedData) {
        throw new Error('Invalid or expired state. Please try connecting again.');
      }

      const { verifier, userId } = storedData;
      console.log('🆔 Found stored state for User ID:', userId);

      // Clean up used state
      twitterPcKeStore.delete(state);

      // Exchange Authorization Code for Access Token
      console.log('🔄 Exchanging code for token...');
      const tokenResponse = await axios.post(
        socialOauthConfig.twitter.tokenURL,
        new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: socialOauthConfig.twitter.clientID,
          redirect_uri: socialOauthConfig.twitter.callbackURL,
          code_verifier: verifier
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // Basic Auth header is NOT required for Public Clients (PKCE), 
            // but usually required for Confidential Clients. 
            // Attempting with Basic Auth (Client ID:Secret) is safer for Web Apps.
            'Authorization': 'Basic ' + Buffer.from(`${socialOauthConfig.twitter.clientID}:${socialOauthConfig.twitter.clientSecret}`).toString('base64')
          }
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;
      console.log('✅ Access Token obtained');

      // Fetch User Profile
      console.log('🔄 Fetching user profile...');
      const userResponse = await axios.get(socialOauthConfig.twitter.userProfileURL, {
        headers: {
          'Authorization': `Bearer ${access_token}`
        },
        params: {
          'user.fields': 'profile_image_url,name,username'
        }
      });

      const userData = userResponse.data.data;
      console.log('👤 Profile fetched:', userData.username);

      const profile = {
        provider: 'twitter',
        id: userData.id,
        username: userData.username,
        displayName: userData.name,
        photos: [{ value: userData.profile_image_url }],
        _json: userData
      };

      const tokens = {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + (expires_in * 1000))
      };

      // Save to DB
      await integrationOauthService.saveOAuthIntegration(userId, 'TWITTER', profile, tokens);
      console.log('✅ Twitter integration saved successfully');

      res.send(`
        <script>
          window.opener.postMessage({ type: 'oauth_success', provider: 'twitter' }, '*');
          window.close();
        </script>
      `);

    } catch (err) {
      console.error('❌ TWITTER OAUTH ERROR:', err.response?.data || err.message);
      res.send(`
        <script>
          window.opener.postMessage({ 
            type: 'oauth_error', 
            provider: 'twitter', 
            error: '${err.message.replace(/'/g, "\\'")}' 
          }, '*');
          window.close();
        </script>
      `);
    }
  }
);

// Facebook Publishing OAuth
router.get('/facebook/connect',
  authenticateToken,
  (req, res, next) => {
    if (!socialOauthConfig.facebook.clientID) {
      return res.status(501).json({ error: 'Facebook OAuth not configured' });
    }
    next();
  },
  passport.authenticate('facebook-publishing', { session: false, scope: socialOauthConfig.facebook.scope })
);

router.get('/facebook/callback',
  passport.authenticate('facebook-publishing', { session: false, failureRedirect: '/settings?error=oauth_failed' }),
  async (req, res) => {
    try {
      const { profile, tokens } = req.user;
      const userId = req.user.userId;

      await integrationOauthService.saveOAuthIntegration(userId, 'FACEBOOK', profile, tokens);

      res.send(`
        <script>
          window.opener.postMessage({ type: 'oauth_success', provider: 'facebook' }, '*');
          window.close();
        </script>
      `);
    } catch (error) {
      console.error('Facebook OAuth error:', error);
      res.send(`
        <script>
          window.opener.postMessage({ type: 'oauth_error', provider: 'facebook', error: '${error.message}' }, '*');
          window.close();
        </script>
      `);
    }
  }
);

module.exports = router;
