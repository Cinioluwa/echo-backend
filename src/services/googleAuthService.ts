// src/services/googleAuthService.ts
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface GoogleUserInfo {
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  picture?: string;
  googleId: string;
}

/**
 * Verifies Google ID token and extracts user information
 * @param token - Google ID token from frontend
 * @returns Verified user information
 * @throws Error if token is invalid or email not verified
 */
export async function verifyGoogleToken(token: string): Promise<GoogleUserInfo> {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid token payload');
    }

    if (!payload.email_verified) {
      throw new Error('Email not verified by Google');
    }

    if (!payload.email) {
      throw new Error('Email not provided by Google');
    }

    return {
      email: payload.email,
      emailVerified: payload.email_verified,
      firstName: payload.given_name || '',
      lastName: payload.family_name || '',
      picture: payload.picture,
      googleId: payload.sub, // Google's unique user ID
    };
  } catch (error) {
    logger.error('Google token verification failed', { error });
    throw new Error('Invalid Google token');
  }
}
