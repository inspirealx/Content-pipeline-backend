// src/services/oauthService.js
const prisma = require('../db/prismaClient');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

class OAuthService {
  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  async findOrCreateUser(provider, profile) {
    try {
      const { id: providerId, emails, displayName, photos } = profile;

      // Validate required profile data
      if (!providerId) {
        throw new ApiError(
          'Invalid OAuth profile: missing provider ID',
          400,
          'OAUTH_INVALID_PROFILE',
          'Unable to connect with provider. Please try again.',
          null,
          { provider }
        );
      }

      // Find existing OAuth account
      let oauthAccount = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerId: {
            provider: provider.toUpperCase(),
            providerId
          }
        },
        include: { user: true }
      });

      if (oauthAccount) {
        // Check if user account is still active
        if (oauthAccount.user.status === 'SUSPENDED') {
          throw new ApiError(
            'User account suspended',
            403,
            'ACCOUNT_SUSPENDED',
            'Your account has been suspended. Please contact support.',
            null,
            { provider }
          );
        }

        // Update OAuth account info
        oauthAccount = await prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: {
            providerEmail: emails?.[0]?.value,
            updatedAt: new Date()
          },
          include: { user: true }
        });
        return oauthAccount.user;
      }

      // Check if user exists with this email
      const email = emails?.[0]?.value;
      let user = email ? await prisma.user.findUnique({ where: { email } }) : null;

      if (user) {
        // Check if user account is suspended
        if (user.status === 'SUSPENDED') {
          throw new ApiError(
            'User account suspended',
            403,
            'ACCOUNT_SUSPENDED',
            'Your account has been suspended. Please contact support.',
            null,
            { provider }
          );
        }

        // Check if this email is already linked to another OAuth account of same provider
        const existingOAuthForEmail = await prisma.oAuthAccount.findFirst({
          where: {
            provider: provider.toUpperCase(),
            providerEmail: email,
            userId: { not: user.id }
          }
        });

        if (existingOAuthForEmail) {
          throw new ApiError(
            'Email already connected to another account',
            409,
            'EMAIL_EXISTS',
            'This account is already connected to another user.',
            'email',
            { provider }
          );
        }

        // Link OAuth to existing user
        await prisma.oAuthAccount.create({
          data: {
            provider: provider.toUpperCase(),
            providerId,
            providerEmail: email,
            userId: user.id
          }
        });
        return user;
      }

      // Validate required fields for new user
      if (!email && !displayName) {
        throw new ApiError(
          'Insufficient profile information from OAuth provider',
          400,
          'OAUTH_INSUFFICIENT_DATA',
          'Unable to create user profile. Please contact support.',
          null,
          { provider }
        );
      }

      // Create new user
      user = await prisma.user.create({
        data: {
          email: email || `${providerId}@${provider}.oauth.local`,
          passwordHash: '', // OAuth users have no password
          name: displayName,
          avatar: photos?.[0]?.value
        }
      });

      // Create OAuth account
      await prisma.oAuthAccount.create({
        data: {
          provider: provider.toUpperCase(),
          providerId,
          providerEmail: email,
          userId: user.id
        }
      });

      return user;
    } catch (error) {
      // Re-throw ApiError instances
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database errors
      throw new ApiError(
        'Database error during OAuth user creation',
        500,
        'OAUTH_DATABASE_ERROR',
        'Failed to create user profile. Please contact support.',
        null,
        { provider }
      );
    }
  }

  generateJWT(user) {
    return jwt.sign({
      userId: user.id,
      email: user.email
    }, config.jwtSecret, { expiresIn: '7d' });
  }
}

module.exports = new OAuthService();
