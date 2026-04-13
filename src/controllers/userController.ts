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
  buildOrganizationAdminAccessRequestEmail,
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
  getDomainCandidates,
  isConsumerEmailDomain,
} from '../utils/domainUtils.js';
import {
  ensurePendingOrganizationJoinRequest,
  getEffectiveJoinPolicy,
} from '../services/organizationJoinPolicyService.js';
import { env } from '../config/env.js';
import { invalidateCacheAfterMutation } from '../utils/cacheInvalidation.js';
import type { Role } from '@prisma/client';

const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID)
  : null;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeName = (value: string) => value.trim();

const CLAIM_REQUEST_INITIAL = 'INITIAL_CLAIM';
const CLAIM_REQUEST_ADMIN_ACCESS = 'ADMIN_ACCESS';

const sanitizePingAuthor = (ping: any) =>
  ping
    ? {
        ...ping,
        author: ping?.isAnonymous ? null : ping?.author ?? null,
        anonymousAlias: ping?.isAnonymous ? (ping?.anonymousAlias ?? null) : undefined,
        anonymousProfilePicture: ping?.isAnonymous ? (ping?.anonymousProfilePicture ?? null) : undefined,
      }
    : ping;

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
    const { email, password, firstName, lastName, level, department, hall, organizationId } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let domain: string;
    try {
      domain = extractDomainFromEmail(email);
  } catch {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    let organization = null as Awaited<
      ReturnType<typeof prisma.organization.findUnique>
    >;

    if (isConsumerEmailDomain(domain)) {
      // Personal email: require explicit org selection
      if (!organizationId) {
        return res.status(400).json({
          error: 'Please select your organization to register.',
          code: 'ORG_ID_REQUIRED_FOR_PERSONAL_EMAIL',
        });
      }

      organization = await prisma.organization.findUnique({ where: { id: organizationId } });

      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found.',
          code: 'ORG_NOT_FOUND',
        });
      }
    } else {
      // Org email: domain-based lookup
      for (const candidate of getDomainCandidates(domain)) {
        // eslint-disable-next-line no-await-in-loop
        const found = await prisma.organization.findUnique({ where: { domain: candidate } });
        if (found) {
          organization = found;
          break;
        }
      }

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
    }

    if (organization.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'This organization is still being onboarded. Please try again later.',
        code: 'ORG_PENDING_ACTIVATION',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const effectiveJoinPolicy = getEffectiveJoinPolicy(organization);

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
      if (existingUser.status !== 'ACTIVE' && effectiveJoinPolicy === 'REQUIRES_APPROVAL') {
        await ensurePendingOrganizationJoinRequest(prisma, {
          organizationId: organization.id,
          userId: existingUser.id,
          email: normalizedEmail,
        });

        return res.status(202).json({
          message:
            'Your account is pending organization approval. Please verify your email and wait for an admin decision.',
          code: 'ORG_JOIN_APPROVAL_REQUIRED',
        });
      }

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
          department,
          hall,
          organizationId: organization.id,
          status: 'PENDING',
        },
      });

      if (effectiveJoinPolicy === 'REQUIRES_APPROVAL') {
        await ensurePendingOrganizationJoinRequest(tx, {
          organizationId: organization.id,
          userId: createdUser.id,
          email: normalizedEmail,
        });
      }

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
    return res.status(effectiveJoinPolicy === 'REQUIRES_APPROVAL' ? 202 : 201).json({
      message:
        effectiveJoinPolicy === 'REQUIRES_APPROVAL'
          ? 'Account created. Verify your email and wait for organization approval before accessing Echo.'
          : 'Account created. Please verify your email to activate your profile.',
      ...(effectiveJoinPolicy === 'REQUIRES_APPROVAL'
        ? { code: 'ORG_JOIN_APPROVAL_REQUIRED' }
        : {}),
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
    const { email, password, organizationId } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let domain: string;
    try {
      domain = extractDomainFromEmail(email);
  } catch {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    let organization = null as Awaited<
      ReturnType<typeof prisma.organization.findUnique>
    >;

    if (isConsumerEmailDomain(domain)) {
      if (!organizationId) {
        return res.status(400).json({
          error: 'Please select your organization to log in.',
          code: 'ORG_ID_REQUIRED_FOR_PERSONAL_EMAIL',
        });
      }

      organization = await prisma.organization.findUnique({ where: { id: organizationId } });

      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found.',
          code: 'ORG_NOT_FOUND',
        });
      }
    } else {
      for (const candidate of getDomainCandidates(domain)) {
        // eslint-disable-next-line no-await-in-loop
        const found = await prisma.organization.findUnique({ where: { domain: candidate } });
        if (found) {
          organization = found;
          break;
        }
      }

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
    }

    if (organization.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Organization onboarding is not complete yet.',
        code: 'ORG_PENDING_ACTIVATION',
      });
    }

    const effectiveJoinPolicy = getEffectiveJoinPolicy(organization);

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
      const pendingJoinRequest = await prisma.organizationJoinRequest.findFirst({
        where: {
          organizationId: organization.id,
          userId: user.id,
          status: 'PENDING',
        },
      });

      if (pendingJoinRequest) {
        return res.status(403).json({
          error: 'Your account is pending organization approval.',
          code: 'ORG_JOIN_APPROVAL_REQUIRED',
        });
      }

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

    // Invalidate cache to ensure fresh data on login
    await invalidateCacheAfterMutation(user.organizationId);

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

    let organization = null as Awaited<
      ReturnType<typeof prisma.organization.findUnique>
    >;

    for (const candidate of getDomainCandidates(domain)) {
      // eslint-disable-next-line no-await-in-loop
      const found = await prisma.organization.findUnique({ where: { domain: candidate } });
      if (found) {
        organization = found;
        break;
      }
    }

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

    const effectiveJoinPolicy = getEffectiveJoinPolicy(organization);

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
          department: null,
          hall: null,
          status: effectiveJoinPolicy === 'REQUIRES_APPROVAL' ? 'PENDING' : 'ACTIVE',
          isVerified: true,
        },
      });

      if (effectiveJoinPolicy === 'REQUIRES_APPROVAL') {
        await ensurePendingOrganizationJoinRequest(prisma, {
          organizationId: organization.id,
          userId: user.id,
          email: normalizedEmail,
        });

        return res.status(202).json({
          message: 'Your account is pending organization approval.',
          code: 'ORG_JOIN_APPROVAL_REQUIRED',
        });
      }
    } else if (user.status !== 'ACTIVE') {
      if (effectiveJoinPolicy === 'REQUIRES_APPROVAL') {
        await ensurePendingOrganizationJoinRequest(prisma, {
          organizationId: organization.id,
          userId: user.id,
          email: normalizedEmail,
        });

        return res.status(202).json({
          message: 'Your account is pending organization approval.',
          code: 'ORG_JOIN_APPROVAL_REQUIRED',
        });
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', isVerified: true },
      });
    }

    const token = issueJwtForUser(user);

    // Invalidate cache to ensure fresh data on login
    await invalidateCacheAfterMutation(user.organizationId);

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

      const effectiveJoinPolicy = getEffectiveJoinPolicy(tokenRecord.user.organization);
      const requiresJoinApproval =
        tokenRecord.user.role === 'USER' && effectiveJoinPolicy === 'REQUIRES_APPROVAL';

      await markEmailVerificationTokenUsed(tx, tokenRecord.id);

      const updatedUser = await tx.user.update({
        where: { id: tokenRecord.userId },
        data: {
          status: requiresJoinApproval ? 'PENDING' : 'ACTIVE',
          isVerified: true,
        },
        include: {
          organization: true,
        },
      });

      if (requiresJoinApproval) {
        await ensurePendingOrganizationJoinRequest(tx, {
          organizationId: updatedUser.organizationId,
          userId: updatedUser.id,
          email: updatedUser.email,
        });
      }

      let organizationActivated = false;

      if (
        env.ORG_ONBOARDING_AUTO_ACTIVATE &&
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

      return { organizationActivated, requiresJoinApproval };
    });

    if (!result) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    return res.status(200).json({
      message: result.organizationActivated
        ? 'Email verified and organization activated.'
        : result.requiresJoinApproval
          ? 'Email verified. Your account is pending organization approval.'
          : 'Email verified successfully.',
      ...(result.requiresJoinApproval
        ? { code: 'ORG_JOIN_APPROVAL_REQUIRED' }
        : {}),
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

    let organization = null as Awaited<
      ReturnType<typeof prisma.organization.findUnique>
    >;

    for (const candidate of getDomainCandidates(domain)) {
      // eslint-disable-next-line no-await-in-loop
      const found = await prisma.organization.findUnique({ where: { domain: candidate } });
      if (found) {
        organization = found;
        break;
      }
    }

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
    const { token, password, newPassword } = req.body;
    const finalPassword = password || newPassword;

    if (typeof token !== 'string' || typeof finalPassword !== 'string') {
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

      const hashedPassword = await bcrypt.hash(finalPassword, 10);

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
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthRequest;
    const { currentPassword, newPassword } = req.body;

    if (!authReq.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: authReq.user.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.password) {
      return res.status(400).json({
        error: 'This account uses Google Sign-In and does not have a password.',
        code: 'GOOGLE_AUTH_ACCOUNT',
      });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatches) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    logger.info('User changed password', {
      userId: user.id,
      requestId: (req as any).requestId,
    });

    return res.status(200).json({ message: 'Password updated successfully.' });
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
    const { organizationName, email, firstName, lastName, metadata } =
      req.body;

    let domain: string;
    try {
      domain = extractDomainFromEmail(email);
  } catch {
      return res.status(400).json({ error: 'Invalid email format' });
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

    const requesterMetadata: Record<string, unknown> = {};
    if (typeof firstName === 'string' && firstName.trim().length > 0) {
      requesterMetadata.requesterFirstName = normalizeName(firstName);
    }
    if (typeof lastName === 'string' && lastName.trim().length > 0) {
      requesterMetadata.requesterLastName = normalizeName(lastName);
    }

    const resolvedMetadata =
      metadata ??
      (Object.keys(requesterMetadata).length > 0 ? requesterMetadata : undefined);

    const requestRecord = await prisma.organizationRequest.create({
      data: {
        organizationName: organizationName.trim(),
        domain: normalizedDomain,
        requesterEmail: normalizedEmail,
        metadata: resolvedMetadata,
      },
    });

    setImmediate(() => {
      const notifyTo = env.PLATFORM_ADMIN_EMAIL ?? env.EMAIL_FROM;
      if (notifyTo) {
        const notification = buildOrganizationRequestEmail(
          organizationName,
          normalizedDomain
        );

        sendEmail({ to: notifyTo, ...notification }).catch((notifyError) => {
          logger.warn('Failed to notify platform admins of new org request', {
            domain: normalizedDomain,
            message: (notifyError as Error).message,
          });
        });
      }
    });

    logger.info('Organization onboarding requested', {
      organizationRequestId: requestRecord.id,
      domain: normalizedDomain,
      requestId: (req as any).requestId,
    });

    return res.status(201).json({
      message: 'Organization request received. Your request will be reviewed by platform admins.',
      requestId: requestRecord.id,
      status: requestRecord.status,
    });
  } catch (error) {
    return next(error);
  }
};

export const listOrganizationsForOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const queryLower = query.toLowerCase();
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(100, Math.trunc(limitRaw)))
      : 25;

    const organizations = await prisma.organization.findMany({
      where: {
        status: 'ACTIVE',
      },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        domain: true,
        isClaimVerified: true,
        categoryCustomizationLocked: true,
      },
    });

    const filtered =
      queryLower.length === 0
        ? organizations
        : organizations.filter((organization) =>
            organization.name.toLowerCase().includes(queryLower) ||
            (organization.domain ?? '').toLowerCase().includes(queryLower)
          );

    const results = filtered.slice(0, limit);

    return res.status(200).json({
      organizations: results,
      count: results.length,
    });
  } catch (error) {
    return next(error);
  }
};

export const submitOrganizationClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = Number(req.params.id);
    if (Number.isNaN(organizationId)) {
      return res.status(400).json({ error: 'Invalid organization id' });
    }

    const { email, firstName, lastName, password, metadata, invitationToken } = req.body;

    let requesterDomain: string;
    try {
      requesterDomain = extractDomainFromEmail(email);
    } catch {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        domain: true,
        isClaimVerified: true,
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!organization.domain) {
      return res.status(400).json({
        error: 'This organization cannot be claimed through domain verification.',
        code: 'ORG_CLAIM_NOT_SUPPORTED',
      });
    }

    if (organization.isClaimVerified) {
      return res.status(409).json({
        error: 'This organization already has verified leadership.',
        code: 'ORG_ALREADY_CLAIMED',
        nextAction: {
          code: 'REQUEST_ADMIN_ACCESS',
          endpoint: `/api/users/organizations/${organization.id}/request-admin-access`,
        },
      });
    }

    if (requesterDomain !== organization.domain.toLowerCase()) {
      return res.status(403).json({
        error: 'Claim email domain does not match the organization domain.',
        code: 'ORG_CLAIM_DOMAIN_MISMATCH',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const hashedPassword = await bcrypt.hash(password, 10);

    const claimResult = await prisma.$transaction(async (tx) => {
      const orgForUpdate = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, isClaimVerified: true },
      });

      if (!orgForUpdate) {
        return { kind: 'org_not_found' as const };
      }

      if (orgForUpdate.isClaimVerified) {
        return { kind: 'already_claimed' as const };
      }

      let user = await tx.user.findUnique({
        where: {
          email_organizationId: {
            email: normalizedEmail,
            organizationId,
          },
        },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: hashedPassword,
            firstName: normalizeName(firstName),
            lastName: normalizeName(lastName),
            organizationId,
            role: 'ADMIN',
            status: 'PENDING',
          },
        });
      }

      const existingPendingClaim = await tx.organizationClaim.findFirst({
        where: {
          organizationId,
          userId: user.id,
          status: 'PENDING',
        },
      });

      if (existingPendingClaim) {
        return { kind: 'duplicate_pending' as const };
      }

      if (invitationToken) {
        const invitation = await tx.invitation.findUnique({
          where: { token: invitationToken as string },
        });

        if (
          !invitation ||
          invitation.organizationId !== organizationId ||
          invitation.expiresAt < new Date() ||
          invitation.status !== 'PENDING'
        ) {
          return { kind: 'invalid_invitation' as const };
        }

        if (invitation.email.toLowerCase() !== normalizedEmail) {
          return { kind: 'invitation_email_mismatch' as const };
        }

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED' },
        });
      }

      const claim = await tx.organizationClaim.create({
        data: {
          organizationId,
          userId: user.id,
          requesterEmail: normalizedEmail,
          metadata: {
            ...(metadata ?? {}),
            requestType: CLAIM_REQUEST_INITIAL,
            invitationToken: invitationToken ?? undefined,
            isInvitedClaim: !!invitationToken,
          },
        },
      });

      const verificationToken = await createEmailVerificationToken(tx, user.id);

      return {
        kind: 'created' as const,
        claim,
        user,
        verificationToken: verificationToken.token,
      };
    });

    if (claimResult.kind === 'org_not_found') {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (claimResult.kind === 'invalid_invitation') {
      return res.status(400).json({ error: 'Invalid or expired invitation token' });
    }

    if (claimResult.kind === 'invitation_email_mismatch') {
      return res.status(403).json({ error: 'Invitation email does not match claim email' });
    }

    if (claimResult.kind === 'already_claimed') {
      return res.status(409).json({
        error: 'This organization already has verified leadership.',
        code: 'ORG_ALREADY_CLAIMED',
        nextAction: {
          code: 'REQUEST_ADMIN_ACCESS',
          endpoint: `/api/users/organizations/${organizationId}/request-admin-access`,
        },
      });
    }

    if (claimResult.kind === 'duplicate_pending') {
      return res.status(409).json({
        error: 'You already have a pending claim for this organization.',
        code: 'ORG_CLAIM_ALREADY_PENDING',
      });
    }

    const verificationEmail = buildVerificationEmail(
      claimResult.verificationToken,
      firstName
    );

    try {
      await sendEmail({ to: normalizedEmail, ...verificationEmail });
    } catch (emailError) {
      logger.error('Failed to dispatch claim verification email', {
        email: normalizedEmail,
        message: (emailError as Error).message,
      });
    }

    return res.status(201).json({
      message: 'Claim submitted. Verify your email to continue review.',
      code: 'ORG_CLAIM_SUBMITTED',
      claim: {
        id: claimResult.claim.id,
        status: claimResult.claim.status,
        organizationId: claimResult.claim.organizationId,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const requestOrganizationAdminAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = Number(req.params.id);
    if (Number.isNaN(organizationId)) {
      return res.status(400).json({ error: 'Invalid organization id' });
    }

    const { email, firstName, lastName, password, reason, metadata } = req.body;

    let requesterDomain: string;
    try {
      requesterDomain = extractDomainFromEmail(email);
    } catch {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        domain: true,
        isClaimVerified: true,
        status: true,
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (organization.status !== 'ACTIVE') {
      return res.status(409).json({
        error: 'Organization must be active before admin-access transfer requests are allowed.',
        code: 'ORG_NOT_ACTIVE',
      });
    }

    if (!organization.isClaimVerified) {
      return res.status(409).json({
        error: 'Organization leadership is not yet verified. Submit a leadership claim instead.',
        code: 'ORG_NOT_YET_VERIFIED',
        nextAction: {
          code: 'SUBMIT_INITIAL_CLAIM',
          endpoint: `/api/users/organizations/${organization.id}/claim`,
        },
      });
    }

    if (organization.domain && requesterDomain !== organization.domain.toLowerCase()) {
      return res.status(403).json({
        error: 'Admin access request email domain does not match the organization domain.',
        code: 'ORG_ADMIN_ACCESS_DOMAIN_MISMATCH',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const hashedPassword = await bcrypt.hash(password, 10);

    const requestResult = await prisma.$transaction(async (tx) => {
      const orgForUpdate = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, isClaimVerified: true },
      });

      if (!orgForUpdate) {
        return { kind: 'org_not_found' as const };
      }

      if (!orgForUpdate.isClaimVerified) {
        return { kind: 'org_not_verified' as const };
      }

      let user = await tx.user.findUnique({
        where: {
          email_organizationId: {
            email: normalizedEmail,
            organizationId,
          },
        },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: hashedPassword,
            firstName: normalizeName(firstName),
            lastName: normalizeName(lastName),
            organizationId,
            role: 'ADMIN',
            status: 'PENDING',
          },
        });
      }

      const existingPendingRequest = await tx.organizationClaim.findFirst({
        where: {
          organizationId,
          userId: user.id,
          status: 'PENDING',
        },
      });

      if (
        existingPendingRequest &&
        typeof existingPendingRequest.metadata === 'object' &&
        existingPendingRequest.metadata !== null &&
        (existingPendingRequest.metadata as Record<string, unknown>).requestType ===
          CLAIM_REQUEST_ADMIN_ACCESS
      ) {
        return { kind: 'duplicate_pending' as const };
      }

      const claim = await tx.organizationClaim.create({
        data: {
          organizationId,
          userId: user.id,
          requesterEmail: normalizedEmail,
          metadata: {
            ...(metadata ?? {}),
            requestType: CLAIM_REQUEST_ADMIN_ACCESS,
            requestReason: typeof reason === 'string' ? reason.trim() : undefined,
          },
        },
      });

      const verificationToken = await createEmailVerificationToken(tx, user.id);

      return {
        kind: 'created' as const,
        claim,
        user,
        verificationToken: verificationToken.token,
      };
    });

    if (requestResult.kind === 'org_not_found') {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (requestResult.kind === 'org_not_verified') {
      return res.status(409).json({
        error: 'Organization leadership is not yet verified. Submit a leadership claim instead.',
        code: 'ORG_NOT_YET_VERIFIED',
        nextAction: {
          code: 'SUBMIT_INITIAL_CLAIM',
          endpoint: `/api/users/organizations/${organizationId}/claim`,
        },
      });
    }

    if (requestResult.kind === 'duplicate_pending') {
      return res.status(409).json({
        error: 'You already have a pending admin access request for this organization.',
        code: 'ORG_ADMIN_ACCESS_ALREADY_PENDING',
      });
    }

    const verificationEmail = buildVerificationEmail(
      requestResult.verificationToken,
      firstName
    );

    try {
      await sendEmail({ to: normalizedEmail, ...verificationEmail });
    } catch (emailError) {
      logger.error('Failed to dispatch admin access verification email', {
        email: normalizedEmail,
        message: (emailError as Error).message,
      });
    }

    setImmediate(async () => {
      try {
        const currentAdmins = await prisma.user.findMany({
          where: {
            organizationId,
            role: { in: ['ADMIN', 'SUPER_ADMIN'] },
            status: 'ACTIVE',
          },
          select: { email: true },
        });

        const recipients = new Set<string>();
        for (const adminUser of currentAdmins) {
          if (adminUser.email.toLowerCase() !== normalizedEmail) {
            recipients.add(adminUser.email);
          }
        }

        if (env.PLATFORM_ADMIN_EMAIL) {
          recipients.add(env.PLATFORM_ADMIN_EMAIL);
        }

        const notification = buildOrganizationAdminAccessRequestEmail(
          organization.name,
          normalizedEmail
        );

        await Promise.allSettled(
          [...recipients].map(async (recipient) => {
            await sendEmail({ to: recipient, ...notification });
          })
        );
      } catch (notifyError) {
        logger.warn('Failed to notify leadership about admin access request', {
          organizationId,
          requesterEmail: normalizedEmail,
          message: (notifyError as Error).message,
        });
      }
    });

    logger.info('Organization admin access requested', {
      organizationId,
      organizationName: organization.name,
      requesterEmail: normalizedEmail,
      requestId: (req as any).requestId,
      claimId: requestResult.claim.id,
    });

    return res.status(201).json({
      message:
        'Admin access request submitted. Verify your email and wait for leadership review.',
      code: 'ORG_ADMIN_ACCESS_REQUEST_SUBMITTED',
      request: {
        id: requestResult.claim.id,
        status: requestResult.claim.status,
        organizationId: requestResult.claim.organizationId,
      },
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
    const { firstName, lastName, level, department, hall, displayName } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID not found' });
    }

    // --- Display Name Mutation Logic ---
    if (displayName !== undefined) {
      const { containsReservedKeyword } = await import('../constants/reservedKeywords.js');

      // 1. Blocklist check
      if (containsReservedKeyword(displayName)) {
        return res.status(400).json({
          error: 'That display name contains a reserved word and cannot be used.',
          code: 'DISPLAY_NAME_RESERVED',
        });
      }

      // 2. Cooldown check
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, displayNameUpdatedAt: true, createdAt: true },
      });

      if (currentUser) {
        const lastChanged = currentUser.displayNameUpdatedAt ?? currentUser.createdAt;
        const now = new Date();
        const msElapsed = now.getTime() - new Date(lastChanged).getTime();
        const GRACE_PERIOD_MS = 15 * 60 * 1000;       // 15 minutes
        const COOLDOWN_MS     = 30 * 24 * 60 * 60 * 1000; // 30 days

        const isWithinGrace   = msElapsed <= GRACE_PERIOD_MS;
        const isWithinCooldown = msElapsed > GRACE_PERIOD_MS && msElapsed < COOLDOWN_MS;

        if (isWithinCooldown && currentUser.displayName !== null) {
          const cooldownEndsAt = new Date(new Date(lastChanged).getTime() + COOLDOWN_MS);
          return res.status(429).json({
            error: 'You can only change your display name once every 30 days. The 15-minute correction window has passed.',
            code: 'DISPLAY_NAME_COOLDOWN',
            cooldownEndsAt: cooldownEndsAt.toISOString(),
          });
        }

        // Persist: transactionally update name + log history
        const updatedUser = await prisma.$transaction(async (tx) => {
          // Archive old name if one exists
          if (currentUser.displayName && currentUser.displayName !== displayName) {
            await tx.displayNameHistory.create({
              data: {
                name: currentUser.displayName,
                userId,
              },
            });
          }

          return tx.user.update({
            where: { id: userId },
            data: {
              displayName,
              displayNameUpdatedAt: new Date(),
              ...(firstName !== undefined && { firstName }),
              ...(lastName !== undefined && { lastName }),
              ...(level !== undefined && { level }),
              ...(department !== undefined && { department }),
              ...(hall !== undefined && { hall }),
            },
          });
        });

        const { password: _pw, ...safeUser } = updatedUser;
        return res.status(200).json({ user: safeUser });
      }
    }

    // --- Standard profile update (no displayName change) ---
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, level, department, hall },
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
        displayName: true,
        displayNameUpdatedAt: true,
        profilePicture: true,
        role: true,         // ← add: needed for role-gating on the UI
        status: true,       // ← add: so UI knows if PENDING / ACTIVE
        level: true,
        department: true,
        hall: true,
        organizationId: true,
        createdAt: true,
        displayNameHistories: {
          orderBy: { changedAt: 'desc' },
          select: { name: true, changedAt: true },
        },
        // ← add: fetch the most recent join request for this user
        organizationJoinRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,   // PENDING | APPROVED | REJECTED
            reason: true,   // rejection reason if rejected
            createdAt: true,
            organization: {
              select: {
                id: true,
                name: true,
                domain: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { organizationJoinRequests, ...rest } = user;

    return res.status(200).json({
      ...rest,
      pendingJoinRequest: organizationJoinRequests[0] ?? null,
    });
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
              isAnonymous: true,
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

    const sanitizedSurges = surges.map((surge) => ({
      ...surge,
      ping: sanitizePingAuthor(surge.ping),
    }));

    return res.status(200).json({
      data: sanitizedSurges,
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
              isAnonymous: true,
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

    const sanitizedComments = comments.map((comment) => ({
      ...comment,
      ping: sanitizePingAuthor(comment.ping),
    }));

    return res.status(200).json({
      data: sanitizedComments,
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

// @desc    Get user analytics (surges, comments, waves) for current or previous week
// @route   GET /api/users/me/analytics
// @access  Private
// @example /api/users/me/analytics?period=previous
export const getMyAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const period = req.query.period as 'current' | 'previous' || 'current';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Determine date range for the requested week
    // We assume weeks start on Sunday
    const now = new Date();
    // Normalize to midnight UTC to ensure consistent bucketing
    now.setUTCHours(0, 0, 0, 0);

    const dayOfWeek = now.getUTCDay(); // 0 (Sun) - 6 (Sat)
    
    // Start of current week (Sunday)
    const currentWeekStart = new Date(now);
    currentWeekStart.setUTCDate(now.getUTCDate() - dayOfWeek);
    
    // Start of previous week (Sunday before)
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setUTCDate(currentWeekStart.getUTCDate() - 7);

    // Set query boundaries based on requested period
    let startDate: Date;
    let endDate: Date;

    if (period === 'previous') {
      startDate = previousWeekStart;
      endDate = currentWeekStart; // Exclusive bound: up to 11:59:59 PM Saturday
    } else {
      startDate = currentWeekStart;
      // End date for current week is 7 days after start
      endDate = new Date(currentWeekStart);
      endDate.setUTCDate(currentWeekStart.getUTCDate() + 7);
    }

    // Parallelize all 4 counts over the date range
    const [
      totalSurges,
      totalComments,
      totalWaves,
      periodSurges,
      periodComments,
      periodWaves
    ] = await Promise.all([
      // Granular All-Time Totals
      prisma.surge.count({ where: { userId } }),
      prisma.comment.count({ where: { authorId: userId, isAnonymous: false } }),
      prisma.wave.count({ where: { authorId: userId } }),

      // Specific Period Queries (Current or Previous Week bounding)
      prisma.surge.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        select: { createdAt: true },
      }),
      prisma.comment.findMany({
        where: {
          authorId: userId,
          isAnonymous: false,
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        select: { createdAt: true },
      }),
      prisma.wave.findMany({
        where: {
          authorId: userId,
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        select: { createdAt: true },
      }),
    ]);

    // Construct exactly 7 daily buckets for the requested week
    const dailyMap = new Map<string, {
      date: string;
      day: string;
      surges: number;
      comments: number;
      waves: number;
    }>();

    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
        const bucketDate = new Date(startDate);
        bucketDate.setUTCDate(startDate.getUTCDate() + i);
        const dateStr = bucketDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
        dailyMap.set(dateStr, {
            date: dateStr,
            day: shortDays[bucketDate.getUTCDay()],
            surges: 0,
            comments: 0,
            waves: 0,
        });
    }

    // Helper to bucket results into mapping
    const bucketItems = (items: { createdAt: Date }[], key: 'surges' | 'comments' | 'waves') => {
      items.forEach((item) => {
        const dateStr = item.createdAt.toISOString().split('T')[0];
        const bucket = dailyMap.get(dateStr);
        if (bucket) {
          bucket[key] += 1;
        }
      });
    };

    bucketItems(periodSurges, 'surges');
    bucketItems(periodComments, 'comments');
    bucketItems(periodWaves, 'waves');

    // Return the tech-lead's exact specified structure
    return res.status(200).json({
      totals: {
        surges: totalSurges,
        comments: totalComments,
        waves: totalWaves,
      },
      daily: Array.from(dailyMap.values()),
    });
  } catch (error) {
    logger.error(`Error fetching user analytics for period: ${req.query.period}`, { error, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get a user's public community profile
// @route   GET /api/users/:id/profile
// @access  Private (authenticated members of same organization)
export const getUserPublicProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (isNaN(targetId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await prisma.user.findFirst({
      where: { id: targetId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        profilePicture: true,
        role: true,
        createdAt: true,
        displayNameHistories: {
          orderBy: { changedAt: 'desc' },
          select: { name: true, changedAt: true },
        },
        pings: {
          where: { isAnonymous: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            status: true,
            progressStatus: true,
            surgeCount: true,
            createdAt: true,
            category: { select: { name: true } },
          },
        },
        wavesAuthored: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            solution: true,
            status: true,
            surgeCount: true,
            createdAt: true,
            ping: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      id: user.id,
      displayName: user.displayName ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      profilePicture: user.profilePicture,
      role: user.role,
      memberSince: user.createdAt,
      previousNames: user.displayNameHistories,
      recentPings: user.pings,
      recentWaves: user.wavesAuthored,
    });
  } catch (error) {
    logger.error('Error fetching public user profile', { error, targetId: req.params.id });
    return next(error);
  }
};
