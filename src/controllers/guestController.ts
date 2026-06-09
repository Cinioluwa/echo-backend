import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { createGuestOtpSession, consumeGuestOtpSession } from '../services/guestOtpService.js';
import { sendEmail, buildGuestOtpEmail } from '../services/emailService.js';
import { invalidateCacheAfterMutation } from '../utils/cacheInvalidation.js';
import { emitPingSurgeUpdate } from '../utils/socketEmitter.js';

export const sendGuestOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, pingId } = req.body;

    if (!email || !pingId) {
      return res.status(400).json({ error: 'Email and pingId are required' });
    }

    const emailNorm = email.toLowerCase().trim();

    // Find the ping to resolve the organization
    const ping = await prisma.ping.findUnique({
      where: { id: parseInt(pingId) },
      select: { id: true, title: true, organizationId: true },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    const { session, rawCode } = await createGuestOtpSession(prisma, emailNorm);

    // Send email
    const emailContent = buildGuestOtpEmail(rawCode, ping.title);
    
    // Non-blocking email dispatch
    setImmediate(() => {
      sendEmail({ to: emailNorm, ...emailContent }).catch((err) => {
        logger.error('Failed to send guest OTP email', { email: emailNorm, error: err });
      });
    });

    return res.status(200).json({ message: 'Verification code sent' });
  } catch (error) {
    logger.error('Error in sendGuestOtp', { error, body: req.body });
    return next(error);
  }
};

export const verifyGuestOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code, pingId } = req.body;

    if (!email || !code || !pingId) {
      return res.status(400).json({ error: 'Email, code, and pingId are required' });
    }

    const emailNorm = email.toLowerCase().trim();

    // Verify code
    try {
      await consumeGuestOtpSession(prisma, emailNorm, code);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    // Resolve ping/org
    const ping = await prisma.ping.findUnique({
      where: { id: parseInt(pingId) },
      select: { id: true, organizationId: true },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    // Create or find guest user
    let guestUser = await prisma.guestUser.findUnique({
      where: { email: emailNorm },
    });

    if (!guestUser) {
      guestUser = await prisma.guestUser.create({
        data: {
          email: emailNorm,
          isVerified: true,
        },
      });
    } else if (!guestUser.isVerified) {
      guestUser = await prisma.guestUser.update({
        where: { id: guestUser.id },
        data: { isVerified: true },
      });
    }

    // Ensure they have org access
    const orgAccess = await prisma.guestOrgAccess.findUnique({
      where: {
        guestUserId_organizationId: {
          guestUserId: guestUser.id,
          organizationId: ping.organizationId,
        },
      },
    });

    if (!orgAccess) {
      await prisma.guestOrgAccess.create({
        data: {
          guestUserId: guestUser.id,
          organizationId: ping.organizationId,
        },
      });
    }

    // Try to surge immediately if they just verified
    let surgeCount = await prisma.surge.count({ where: { pingId: ping.id } }) + 
                     await prisma.guestSurge.count({ where: { pingId: ping.id } });
                     
    let surged = false;
    
    // Check if they already surged
    const existingSurge = await prisma.guestSurge.findUnique({
      where: {
        guestUserId_pingId: {
          guestUserId: guestUser.id,
          pingId: ping.id,
        },
      },
    });

    if (!existingSurge) {
      try {
        await prisma.guestSurge.create({
          data: {
            guestUserId: guestUser.id,
            organizationId: ping.organizationId,
            pingId: ping.id,
          },
        });
        
        // Sync normal surge count up so public views are accurate
        surgeCount += 1;
        await prisma.ping.update({
          where: { id: ping.id },
          data: { surgeCount },
        });
        
        await invalidateCacheAfterMutation(ping.organizationId);
        emitPingSurgeUpdate(ping.organizationId, { pingId: ping.id, surgeCount, surged: true });
        surged = true;
      } catch (e: any) {
        // Unique constraint or race condition
        if (e.code === 'P2002') {
          surged = true;
        } else {
          throw e;
        }
      }
    } else {
        surged = true;
    }

    // Issue JWT
    const token = jwt.sign(
      {
        guestUserId: guestUser.id,
        organizationId: ping.organizationId,
        role: 'GUEST',
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      message: 'Verified successfully',
      token,
      surged,
      surgeCount,
    });
  } catch (error) {
    logger.error('Error in verifyGuestOtp', { error, body: req.body });
    return next(error);
  }
};

export const guestSurgePing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;
    const guest = (req as any).guest;

    if (!guest || guest.role !== 'GUEST') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const pingIdInt = parseInt(pingId);

    const ping = await prisma.ping.findFirst({
      where: {
        id: pingIdInt,
        organizationId: guest.organizationId,
      },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found in your organization' });
    }

    const existingSurge = await prisma.guestSurge.findUnique({
      where: {
        guestUserId_pingId: {
          guestUserId: guest.guestUserId,
          pingId: pingIdInt,
        },
      },
    });

    if (existingSurge) {
      // Toggle logic: delete surge
      await prisma.guestSurge.delete({ where: { id: existingSurge.id } });
      const count = await prisma.surge.count({ where: { pingId: pingIdInt } }) +
                    await prisma.guestSurge.count({ where: { pingId: pingIdInt } });
                    
      await prisma.ping.update({ where: { id: pingIdInt }, data: { surgeCount: count } });
      await invalidateCacheAfterMutation(guest.organizationId);
      emitPingSurgeUpdate(guest.organizationId, { pingId: pingIdInt, surgeCount: count, surged: false });
      
      return res.status(200).json({ message: 'Surge removed', surged: false, surgeCount: count });
    }

    // Add surge
    try {
      await prisma.guestSurge.create({
        data: {
          guestUserId: guest.guestUserId,
          organizationId: guest.organizationId,
          pingId: pingIdInt,
        },
      });
    } catch (err: any) {
      if (err.code !== 'P2002') {
        throw err;
      }
    }

    const count = await prisma.surge.count({ where: { pingId: pingIdInt } }) +
                  await prisma.guestSurge.count({ where: { pingId: pingIdInt } });
                  
    await prisma.ping.update({ where: { id: pingIdInt }, data: { surgeCount: count } });
    await invalidateCacheAfterMutation(guest.organizationId);
    emitPingSurgeUpdate(guest.organizationId, { pingId: pingIdInt, surgeCount: count, surged: true });
    
    return res.status(200).json({ message: 'Ping surged', surged: true, surgeCount: count });
  } catch (error) {
    logger.error('Error in guestSurgePing', { error, params: req.params });
    return next(error);
  }
};
