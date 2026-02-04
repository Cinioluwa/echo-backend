// src/controllers/googleAuthController.ts
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types/AuthRequest.js';
import { verifyGoogleToken } from '../services/googleAuthService.js';
import { extractDomainFromEmail, getDomainCandidates, isConsumerEmailDomain } from '../utils/domainUtils.js';
import { invalidateCacheAfterMutation } from '../utils/cacheInvalidation.js';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { env } from '../config/env.js';
import type { Role } from '@prisma/client';

const issueJwtForUser = (user: {
  id: number;
  organizationId: number;
  role: Role;
}) =>
  jwt.sign(
    {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

/**
 * Google OAuth Sign-In/Sign-Up Handler
 * 
 * Flow:
 * 1. Verify Google ID token
 * 2. Extract email and lookup organization by domain
 * 3. Check if user exists → Login
 * 4. If new user → Create account (auto-verified since Google verified email)
 * 5. Issue JWT token with organizationId
 */
export async function googleAuth(req: AuthRequest, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Google token is required' });
    }

    // Step 1: Verify token with Google
    const googleUser = await verifyGoogleToken(token);
    const { email, firstName, lastName, googleId, picture } = googleUser;

    // Step 2: Block consumer email domains (same logic as regular registration)
    const domain = extractDomainFromEmail(email);
    if (isConsumerEmailDomain(domain)) {
      return res.status(400).json({
        error: 'Please use your company email address. Consumer email domains are not allowed.',
      });
    }

    // Step 3: Lookup organization by domain
    let organization = null as Awaited<
      ReturnType<typeof prisma.organization.findUnique>
    >;

    for (const candidate of getDomainCandidates(domain)) {
      // eslint-disable-next-line no-await-in-loop
      const found = await prisma.organization.findUnique({
        where: { domain: candidate },
      });
      if (found) {
        organization = found;
        break;
      }
    }

    if (!organization) {
      return res.status(404).json({
        error: `No organization found for domain: ${domain}. Please contact your administrator.`,
      });
    }

    if (organization.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Your organization is not active. Please contact support.',
      });
    }

    // Step 4: Check if user exists
    let user = await prisma.user.findUnique({
      where: {
        email_organizationId: {
          email,
          organizationId: organization.id,
        },
      },
    });

    // Step 5: Create new user if doesn't exist
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          organizationId: organization.id,
          role: 'USER', // Default role
          status: 'ACTIVE', // Auto-activate since Google verified email
          isVerified: true, // Skip email verification
          googleId, // Store Google's unique ID
          profilePicture: picture,
          // No password field - Google OAuth users don't have passwords
        },
      });

      logger.info('New user created via Google Auth', {
        userId: user.id,
        email: user.email,
        organizationId: organization.id,
      });
    } else {
      // Update existing user with Google info if not already set
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            profilePicture: picture || user.profilePicture,
            isVerified: true,
            status: 'ACTIVE',
          },
        });
      }

      logger.info('Existing user logged in via Google Auth', {
        userId: user.id,
        email: user.email,
      });
    }

    // Step 6: Issue JWT token (same as regular login)
    const jwtToken = issueJwtForUser(user);

    // Invalidate cache to ensure fresh data on login
    await invalidateCacheAfterMutation(user.organizationId);

    return res.status(200).json({
      message: 'Google authentication successful',
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    logger.error('Google auth error', { error });

    if (error instanceof Error) {
      if (error.message.includes('Invalid Google token') || error.message.includes('Invalid token payload')) {
        return res.status(401).json({ error: 'Invalid Google token' });
      }
      if (error.message.includes('Email not verified')) {
        return res.status(400).json({ error: 'Please verify your email with Google first' });
      }
    }

    return res.status(500).json({ error: 'Internal server error during Google authentication' });
  }
}
