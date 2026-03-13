// src/controllers/organizationController.ts
import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';
import crypto from 'crypto';
import { sendEmail, buildLeaderInvitationEmail } from '../services/emailService.js';

/**
 * @desc    Invite a potential leader to claim an organization
 * @route   POST /api/public/organizations/:id/invite-leader
 * @access  Private (Authenticated users)
 */
export const inviteLeader = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = Number(req.params.id);
    const { email } = req.body;
    const inviterId = req.user?.userId;

    if (!inviterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, isClaimVerified: true }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Guardrail: If already verified, we might still allow invitations for additional admins/reps,
    // but the primary use case is for empty spaces.
    // For now, let's just proceed as per user request "anyone can invite".

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        email: email.toLowerCase().trim(),
        token,
        organizationId,
        role: 'ADMIN', // The invited person will likely claim the admin/leader role
        expiresAt,
        status: 'PENDING'
      }
    });

    const emailContent = buildLeaderInvitationEmail(organization.name, token, organizationId);
    
    try {
      await sendEmail({
        to: email,
        ...emailContent
      });
    } catch (emailError) {
      logger.error('Failed to send leader invitation email', {
        email,
        organizationId,
        error: (emailError as Error).message
      });
      
      // Rollback database record if email delivery fails
      await prisma.invitation.delete({
        where: { id: invitation.id }
      });

      return res.status(500).json({ 
        error: 'Failed to send invitation email. Please try again later.',
        code: 'EMAIL_DELIVERY_FAILURE' 
      });
    }

    logger.info('Leader invitation sent', {
      organizationId,
      invitedEmail: email,
      inviterId,
      invitationId: invitation.id
    });

    return res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    logger.error('Error inviting leader', { error, organizationId: req.params.id });
    return next(error);
  }
};
