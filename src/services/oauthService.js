// src/services/oauthService.js
const prisma = require('../db/prismaClient');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const crypto = require('crypto');

class OAuthService {
  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  async findOrCreateUser(provider, profile) {
    const { id: providerId, emails, displayName, photos } = profile;
    
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
  }

  generateJWT(user) {
    return jwt.sign({
      userId: user.id,
      email: user.email
    }, config.jwtSecret, { expiresIn: '7d' });
  }
}

module.exports = new OAuthService();
