// src/controllers/userController.ts
import { NextFunction, Request, Response } from 'express';
import prisma from '../config/db.js'; // Import our central prisma client
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';
import {
  buildOrganizationRequestEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
  sendEmail,
} from '../services/emailService.js';
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  markEmailVerificationTokenUsed,
  markPasswordResetTokenUsed,
} from '../services/tokenService.js';
import {
  extractDomainFromEmail,
  isConsumerEmailDomain,
} from '../utils/domainUtils.js';
import { env } from '../config/env.js';
import type { Role } from '@prisma/client';

const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID)
  : null;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeName = (value: string) => value.trim();

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
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );
// Even though this is a TypeScript file, when using moduleResolution "node16"/"nodenext" with ESM,
// relative imports must include the .js extension to match the emitted JavaScript files.
export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, firstName, lastName, level } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let domain: string;
    try {
      domain = extractDomainFromEmail(email);
  } catch {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (isConsumerEmailDomain(domain)) {
      return res.status(400).json({
        error: 'Personal email domains are not supported. Please use your organization email.',
        code: 'CONSUMER_DOMAIN_NOT_ALLOWED',
      });
    }

    const organization = await prisma.organization.findUnique({ where: { domain } });

    if (!organization) {
      logger.info('Registration attempt for unknown domain', {
        domain,
        email,
        requestId: (req as any).requestId,
      });
      return res.status(404).json({
        error: 'No organization is registered for this email domain.',
        code: 'ORG_NOT_FOUND',
        domain,
      });
    }

    if (organization.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'This organization is still being onboarded. Please try again later.',
        code: 'ORG_PENDING_ACTIVATION',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    // Check if user already exists in the org
    const existingUser = await prisma.user.findUnique({
      where: {
        email_organizationId: {
          email: normalizedEmail,
          organizationId: organization.id,
        },
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists. Try logging in instead.',
        code: 'ACCOUNT_EXISTS',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { user, verificationToken } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          firstName: normalizeName(firstName),
          lastName: normalizeName(lastName),
          level: typeof level === 'number' ? level : null,
          organizationId: organization.id,
        },
      });

      const tokenRecord = await createEmailVerificationToken(tx, createdUser.id);

      return { user: createdUser, verificationToken: tokenRecord };
    });

    const verificationEmail = buildVerificationEmail(
      verificationToken.token,
      firstName
    );

    try {
      await sendEmail({ to: normalizedEmail, ...verificationEmail });
    } catch (emailError) {
      logger.error('Failed to dispatch verification email', {
        email: normalizedEmail,
        message: (emailError as Error).message,
      });
    }

    logger.info('New user registered', {
      userId: user.id,
      email: normalizedEmail,
      organizationId: user.organizationId,
      requestId: (req as any).requestId,
    });

    const { password: _pw, ...safeUser } = user as any;
    return res.status(201).json({
      message: 'Account created. Please verify your email to activate your profile.',
      user: safeUser,
    });
  } catch (error) {
    return next(error);
  }
};

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let domain: string;
    try {
      domain = extractDomainFromEmail(email);
  } catch {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const organization = await prisma.organization.findUnique({ where: { domain } });

    if (!organization) {
      logger.warn('Login attempt for unknown organization domain', {
        domain,
        email,
        requestId: (req as any).requestId,
      });
      return res.status(404).json({
        error: 'No organization is registered for this email domain.',
        code: 'ORG_NOT_FOUND',
      });
    }

    if (organization.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Organization onboarding is not complete yet.',
        code: 'ORG_PENDING_ACTIVATION',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: {
        email_organizationId: {
          email: normalizedEmail,
          organizationId: organization.id,
        },
      },
    });

    if (!user) {
      logger.warn('Failed login attempt - user not found', {
        email: normalizedEmail,
        organizationId: organization.id,
        requestId: (req as any).requestId,
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        code: 'ACCOUNT_PENDING_VERIFICATION',
      });
    }

    // Check if user has a password (Google OAuth users don't have passwords)
    if (!user.password) {
      return res.status(400).json({
        error: 'This account uses Google Sign-In. Please sign in with Google.',
        code: 'GOOGLE_AUTH_REQUIRED',
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      logger.warn('Failed login attempt - bad password', {
        email: normalizedEmail,
        organizationId: organization.id,
        requestId: (req as any).requestId,
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = issueJwtForUser(user);

    logger.info('User logged in', {
      userId: user.id,
      email: normalizedEmail,
      organizationId: user.organizationId,
      requestId: (req as any).requestId,
    });

    return res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    return next(error); // removed res.status(500).json(...) to avoid double-send
  }
};

export const loginWithGoogle = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!googleClient || !env.GOOGLE_CLIENT_ID) {
    return res
      .status(501)
      .json({ error: 'Google authentication is not configured.' });
  }

  try {
    const { idToken } = req.body;

    if (typeof idToken !== 'string' || idToken.trim() === '') {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(400).json({ error: 'Google account has no email' });
    }

    const email = payload.email;
    let domain: string;
    try {
      domain = extractDomainFromEmail(email);
  } catch {
      return res.status(400).json({ error: 'Google email is invalid' });
    }

    const organization = await prisma.organization.findUnique({ where: { domain } });

    if (!organization) {
      return res.status(404).json({
        error: 'No organization is registered for this email domain.',
        code: 'ORG_NOT_FOUND',
      });
    }

    if (organization.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Organization onboarding is not complete yet.',
        code: 'ORG_PENDING_ACTIVATION',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    let user = await prisma.user.findUnique({
      where: {
        email_organizationId: {
          email: normalizedEmail,
          organizationId: organization.id,
        },
      },
    });

    if (!user) {
      const passwordPlaceholder = crypto.randomBytes(48).toString('hex');
      const hashedPassword = await bcrypt.hash(passwordPlaceholder, 10);

      const derivedFirstName =
        payload.given_name ?? payload.name?.split(' ')[0] ?? 'Echo';
      const derivedLastName =
        payload.family_name ?? payload.name?.split(' ').slice(1).join(' ') ?? 'User';

      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          firstName: normalizeName(derivedFirstName),
          lastName: normalizeName(derivedLastName),
          organizationId: organization.id,
          status: 'ACTIVE',
        },
      });
    } else if (user.status !== 'ACTIVE') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });
    }

    const token = issueJwtForUser(user);

    logger.info('User logged in via Google', {
      userId: user.id,
      email: normalizedEmail,
      organizationId: user.organizationId,
      requestId: (req as any).requestId,
    });

    return res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    return next(error);
  }
};

export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.body;

    if (typeof token !== 'string' || token.trim() === '') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.emailVerificationToken.findFirst({
        where: {
          token,
          used: false,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            include: {
              organization: true,
            },
          },
        },
      });

      if (!tokenRecord) {
        return null;
      }

      await markEmailVerificationTokenUsed(tx, tokenRecord.id);

      const updatedUser = await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { status: 'ACTIVE' },
        include: {
          organization: true,
        },
      });

      let organizationActivated = false;

      if (
        updatedUser.role === 'ADMIN' &&
        updatedUser.organization?.status !== 'ACTIVE'
      ) {
        await tx.organization.update({
          where: { id: updatedUser.organizationId },
          data: { status: 'ACTIVE' },
        });

        await tx.organizationRequest.updateMany({
          where: { organizationId: updatedUser.organizationId },
          data: { status: 'APPROVED', resolvedAt: new Date() },
        });

        organizationActivated = true;
      }

      await tx.emailVerificationToken.deleteMany({
        where: { userId: updatedUser.id, used: false },
      });

      return { organizationActivated };
    });

    if (!result) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    return res.status(200).json({
      message: result.organizationActivated
        ? 'Email verified and organization activated.'
        : 'Email verified successfully.',
    });
  } catch (error) {
    return next(error);
  }
};

export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    if (typeof email !== 'string') {
      return res.status(200).json({
        message:
          'If an account exists for that email, a password reset link will arrive shortly.',
      });
    }

    let domain: string | null = null;
    try {
      domain = extractDomainFromEmail(email);
  } catch {
      // Swallow to avoid leaking
      domain = null;
    }

    if (!domain) {
      return res.status(200).json({
        message:
          'If an account exists for that email, a password reset link will arrive shortly.',
      });
    }

    const organization = await prisma.organization.findUnique({ where: { domain } });

    if (!organization) {
      return res.status(200).json({
        message:
          'If an account exists for that email, a password reset link will arrive shortly.',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: {
        email_organizationId: {
          email: normalizedEmail,
          organizationId: organization.id,
        },
      },
      select: {
        id: true,
        firstName: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(200).json({
        message:
          'If an account exists for that email, a password reset link will arrive shortly.',
      });
    }

    const tokenRecord = await prisma.$transaction(async (tx) =>
      createPasswordResetToken(tx, user.id)
    );

    const resetEmail = buildPasswordResetEmail(tokenRecord.token);

    try {
      await sendEmail({ to: normalizedEmail, ...resetEmail });
    } catch (emailError) {
      logger.error('Failed to dispatch reset email', {
        email: normalizedEmail,
        message: (emailError as Error).message,
      });
    }

    logger.info('Password reset token generated', {
      userId: user.id,
      requestId: (req as any).requestId,
    });

    return res.status(200).json({
      message:
        'If an account exists for that email, a password reset link will arrive shortly.',
    });
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, password } = req.body;

    if (typeof token !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.passwordResetToken.findFirst({
        where: {
          token,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!tokenRecord) {
        return null;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const updatedUser = await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { password: hashedPassword, status: 'ACTIVE' },
      });

      await markPasswordResetTokenUsed(tx, tokenRecord.id);
      await tx.passwordResetToken.deleteMany({
        where: { userId: tokenRecord.userId, used: false },
      });

      return updatedUser;
    });

    if (!result) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    logger.info('Password reset completed', {
      userId: result.id,
      requestId: (req as any).requestId,
    });

    return res
      .status(200)
      .json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    return next(error);
  }
};

export const requestOrganizationOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { organizationName, email, firstName, lastName, password, metadata } =
      req.body;

    let domain: string;
    try {
      domain = extractDomainFromEmail(email);
  } catch {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (isConsumerEmailDomain(domain)) {
      return res.status(400).json({
        error: 'Consumer email domains are not supported for organization onboarding.',
        code: 'CONSUMER_DOMAIN_NOT_ALLOWED',
      });
    }

    const normalizedDomain = domain;
    const normalizedEmail = normalizeEmail(email);

    const existingOrganization = await prisma.organization.findUnique({
      where: { domain: normalizedDomain },
    });

    if (existingOrganization) {
      return res.status(409).json({
        error: 'An organization with this domain already exists.',
        code:
          existingOrganization.status === 'ACTIVE'
            ? 'ORG_ALREADY_ACTIVE'
            : 'ORG_PENDING_ACTIVATION',
      });
    }

    const existingRequest = await prisma.organizationRequest.findUnique({
      where: { domain: normalizedDomain },
    });

    if (existingRequest) {
      return res.status(409).json({
        error: 'A request for this organization is already in progress.',
        code: 'ORG_REQUEST_EXISTS',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName.trim(),
          domain: normalizedDomain,
          status: 'PENDING',
        },
      });

      const adminUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          firstName: normalizeName(firstName),
          lastName: normalizeName(lastName),
          organizationId: organization.id,
          role: 'ADMIN',
          status: 'PENDING',
        },
      });

      const requestRecord = await tx.organizationRequest.create({
        data: {
          organizationName: organizationName.trim(),
          domain: normalizedDomain,
          requesterEmail: normalizedEmail,
          organizationId: organization.id,
          metadata: metadata ?? undefined,
        },
      });

      const verificationToken = await createEmailVerificationToken(
        tx,
        adminUser.id
      );

      return { organization, adminUser, requestRecord, verificationToken };
    });

    const verificationEmail = buildVerificationEmail(
      result.verificationToken.token,
      firstName
    );

    try {
      await sendEmail({ to: normalizeEmail(email), ...verificationEmail });
    } catch (emailError) {
      logger.error('Failed to dispatch onboarding verification email', {
        email: normalizeEmail(email),
        message: (emailError as Error).message,
      });
    }

    if (env.EMAIL_FROM) {
      const notification = buildOrganizationRequestEmail(
        organizationName,
        normalizedDomain
      );

      try {
        await sendEmail({ to: env.EMAIL_FROM, ...notification });
      } catch (notifyError) {
        logger.warn('Failed to notify platform admins of new org request', {
          domain: normalizedDomain,
          message: (notifyError as Error).message,
        });
      }
    }

    logger.info('Organization onboarding requested', {
      organizationId: result.organization.id,
      domain: normalizedDomain,
      requestId: (req as any).requestId,
    });

    return res.status(201).json({
      message: 'Organization request received. Check your email to verify the admin account.',
      organizationId: result.organization.id,
      organizationStatus: 'PENDING',
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID not found' });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export const updateCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { firstName, lastName, level } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, level },
    });
    const { password: _pw, ...safeUser } = updatedUser;

    return res.status(200).json({ user: safeUser });
  } catch (error) {
    return next(error);
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        level: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (error) {
    logger.error('Error fetching user', { error, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get all surges (likes) by the current user
// @route   GET /api/users/me/surges
// @access  Private
export const getMySurges = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const [surges, totalSurges] = await prisma.$transaction([
      prisma.surge.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ping: {
            select: {
              id: true,
              title: true,
              category: true,
              status: true,
              createdAt: true,
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          wave: {
            select: {
              id: true,
              solution: true,
              viewCount: true,
              createdAt: true,
              pingId: true,
            },
          },
        },
      }),
      prisma.surge.count({ where: { userId } }),
    ]);

    const totalPages = Math.ceil(totalSurges / limit);

    return res.status(200).json({
      data: surges,
      pagination: {
        totalSurges,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching user surges', { error, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get all comments by the current user
// @route   GET /api/users/me/comments
// @access  Private
export const getMyComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const [comments, totalComments] = await prisma.$transaction([
      prisma.comment.findMany({
        where: { authorId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ping: {
            select: {
              id: true,
              title: true,
              category: true,
              status: true,
              createdAt: true,
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          wave: {
            select: {
              id: true,
              solution: true,
              viewCount: true,
              createdAt: true,
              pingId: true,
            },
          },
        },
      }),
      prisma.comment.count({ where: { authorId: userId } }),
    ]);

    const totalPages = Math.ceil(totalComments / limit);

    return res.status(200).json({
      data: comments,
      pagination: {
        totalComments,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching user comments', { error, userId: req.user?.userId });
    return next(error);
  }
};
