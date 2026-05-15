import { NextFunction, Response } from 'express';
import { ModerationAction, ModerationStatus } from '@prisma/client';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps suspension preset strings to actual Date offsets */
const SUSPEND_PRESET_MS: Record<string, number> = {
    '1_DAY': 24 * 60 * 60 * 1000,
    '1_WEEK': 7 * 24 * 60 * 60 * 1000,
    '1_MONTH': 30 * 24 * 60 * 60 * 1000,
};

const PRESET_LABELS: Record<string, string> = {
    '1_DAY': '1 day',
    '1_WEEK': '1 week',
    '1_MONTH': '1 month',
};

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * POST /api/admin/reports/:id/action
 *
 * Applies one of the six moderation actions to a flagged report.
 * The leader never needs to know who the anonymous poster is to take the first five actions.
 * Identity disclosure escalates to Echo super-admins only.
 */
export const applyModerationAction = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const organizationId = req.organizationId;
        const actorId = req.user?.userId;

        if (!organizationId || !actorId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const reportId = Number(req.params.id);
        const { action, note } = req.body as {
            action: ModerationAction;
            suspendPreset?: string;
            note?: string;
        };
        const suspendPreset = (req.body as any).suspendPreset as string | undefined;

        // ── Fetch report with all needed relations ──────────────────────────
        const report = await prisma.report.findFirst({
            where: { id: reportId, organizationId },
            select: {
                id: true,
                status: true,
                action: true,
                pingId: true,
                waveId: true,
                commentId: true,
                ping: {
                    select: {
                        id: true,
                        authorId: true,
                        title: true,
                        status: true,
                    },
                },
                wave: {
                    select: {
                        id: true,
                        authorId: true,
                        status: true,
                    },
                },
                comment: {
                    select: {
                        id: true,
                        authorId: true,
                    },
                },
            },
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Block re-actioning already finalised reports
        if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
            return res.status(409).json({
                error: 'This report has already been resolved and cannot be actioned again.',
            });
        }

        // ── Derive the affected content author ─────────────────────────────
        // Important: we work with authorId only — never expose real identity
        const contentAuthorId =
            report.ping?.authorId ?? report.wave?.authorId ?? report.comment?.authorId ?? null;

        // ── Execute action inside a transaction ────────────────────────────
        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update the report itself
            const reportUpdateData: any = {
                action,
                actionNote: note ?? null,
                actionedAt: now,
                actionedById: actorId,
            };

            let updatedReport;

            switch (action) {
                // ── DISMISS ─────────────────────────────────────────────────
                case ModerationAction.DISMISS: {
                    reportUpdateData.status = 'DISMISSED';
                    updatedReport = await tx.report.update({
                        where: { id: reportId },
                        data: reportUpdateData,
                    });
                    break;
                }

                // ── WARN ────────────────────────────────────────────────────
                case ModerationAction.WARN: {
                    reportUpdateData.status = 'REVIEWED';
                    updatedReport = await tx.report.update({
                        where: { id: reportId },
                        data: reportUpdateData,
                    });

                    // Update user's moderation status to WARNED (keeps a history marker)
                    if (contentAuthorId) {
                        await tx.user.update({
                            where: { id: contentAuthorId },
                            data: { moderationStatus: ModerationStatus.WARNED },
                        });

                        // Notify the author (by userId, NOT by revealing their identity)
                        await tx.notification.create({
                            data: {
                                userId: contentAuthorId,
                                organizationId,
                                type: 'MODERATION_WARNING',
                                title: 'Community guidelines warning',
                                body: 'A leader has reviewed a report about one of your posts and issued a warning. Please review the community guidelines.',
                                pingId: report.pingId ?? undefined,
                                waveId: report.waveId ?? undefined,
                                commentId: report.commentId ?? undefined,
                            },
                        });
                    }
                    break;
                }

                // ── REMOVE POST ─────────────────────────────────────────────
                case ModerationAction.REMOVE_POST: {
                    reportUpdateData.status = 'RESOLVED';
                    updatedReport = await tx.report.update({
                        where: { id: reportId },
                        data: reportUpdateData,
                    });

                    // Soft-delete the content by marking it REJECTED (reusing existing Status enum)
                    if (report.pingId) {
                        await tx.ping.update({
                            where: { id: report.pingId },
                            data: { status: 'REJECTED' },
                        });
                    } else if (report.waveId) {
                        await tx.wave.update({
                            where: { id: report.waveId },
                            data: { status: 'REJECTED' },
                        });
                    }
                    // Comments don't have a status field; they are hard-deleted
                    else if (report.commentId) {
                        await tx.comment.delete({ where: { id: report.commentId } });
                    }
                    break;
                }

                // ── SUSPEND ─────────────────────────────────────────────────
                case ModerationAction.SUSPEND: {
                    if (!suspendPreset || !(suspendPreset in SUSPEND_PRESET_MS)) {
                        throw new Error('Invalid or missing suspendPreset for SUSPEND action.');
                    }

                    const suspendedUntil = new Date(now.getTime() + SUSPEND_PRESET_MS[suspendPreset]);

                    reportUpdateData.status = 'RESOLVED';
                    updatedReport = await tx.report.update({
                        where: { id: reportId },
                        data: reportUpdateData,
                    });

                    if (contentAuthorId) {
                        await tx.user.update({
                            where: { id: contentAuthorId },
                            data: {
                                moderationStatus: ModerationStatus.SUSPENDED,
                                suspendedUntil,
                            },
                        });

                        await tx.notification.create({
                            data: {
                                userId: contentAuthorId,
                                organizationId,
                                type: 'MODERATION_SUSPENSION',
                                title: 'Posting suspended',
                                body: `Your ability to post has been temporarily suspended for ${PRESET_LABELS[suspendPreset]}. You can still read all content.`,
                                pingId: report.pingId ?? undefined,
                                waveId: report.waveId ?? undefined,
                                commentId: report.commentId ?? undefined,
                            },
                        });
                    }
                    break;
                }

                // ── BAN ──────────────────────────────────────────────────────
                case ModerationAction.BAN: {
                    reportUpdateData.status = 'RESOLVED';
                    updatedReport = await tx.report.update({
                        where: { id: reportId },
                        data: reportUpdateData,
                    });

                    if (contentAuthorId) {
                        await tx.user.update({
                            where: { id: contentAuthorId },
                            data: {
                                moderationStatus: ModerationStatus.BANNED,
                                suspendedUntil: null,
                            },
                        });

                        await tx.notification.create({
                            data: {
                                userId: contentAuthorId,
                                organizationId,
                                type: 'MODERATION_BAN',
                                title: 'Posting permanently banned',
                                body: 'Your ability to post in this Echo space has been permanently revoked. You can still read all content.',
                                pingId: report.pingId ?? undefined,
                                waveId: report.waveId ?? undefined,
                                commentId: report.commentId ?? undefined,
                            },
                        });
                    }
                    break;
                }

                // ── REQUEST IDENTITY DISCLOSURE ──────────────────────────────
                case ModerationAction.REQUEST_IDENTITY_DISCLOSURE: {
                    if (!note || note.trim().length < 50) {
                        throw new Error(
                            'A written justification of at least 50 characters is required.',
                        );
                    }

                    reportUpdateData.status = 'REVIEWED';
                    updatedReport = await tx.report.update({
                        where: { id: reportId },
                        data: reportUpdateData,
                    });

                    // Notify all SUPER_ADMINs on the platform (not org-scoped)
                    const superAdmins = await tx.user.findMany({
                        where: { role: 'SUPER_ADMIN' },
                        select: { id: true },
                    });

                    if (superAdmins.length > 0) {
                        await tx.notification.createMany({
                            data: superAdmins.map((sa) => ({
                                userId: sa.id,
                                organizationId,
                                type: 'MODERATION_IDENTITY_DISCLOSURE_REQUESTED' as const,
                                title: 'Identity disclosure request',
                                body: `An organization admin has requested identity disclosure for a reported post. Justification: ${note.slice(0, 120)}${note.length > 120 ? '...' : ''}`,
                                pingId: report.pingId ?? undefined,
                                waveId: report.waveId ?? undefined,
                                commentId: report.commentId ?? undefined,
                            })),
                        });
                    }
                    break;
                }

                default:
                    return res.status(400).json({ error: 'Unknown moderation action.' });
            }

            return updatedReport;
        });

        return res.status(200).json(result);
    } catch (error: any) {
        // Surface validation errors as 400 rather than 500
        if (
            error?.message?.includes('Invalid or missing') ||
            error?.message?.includes('justification')
        ) {
            return res.status(400).json({ error: error.message });
        }
        return next(error);
    }
};
