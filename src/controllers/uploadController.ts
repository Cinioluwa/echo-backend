// src/controllers/uploadController.ts
import type { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import type { AuthRequest } from '../types/AuthRequest.js';
import {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  uploadForProfile,
  isCloudinaryConfigured,
  getOrganizationFolder,
} from '../services/uploadService.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Media:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         url:
 *           type: string
 *         filename:
 *           type: string
 *         mimeType:
 *           type: string
 *         size:
 *           type: integer
 *         width:
 *           type: integer
 *           nullable: true
 *         height:
 *           type: integer
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/uploads:
 *   post:
 *     summary: Upload media files
 *     description: Upload one or more media files (images, videos, PDFs). Returns media IDs to attach to pings/waves.
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               entityType:
 *                 type: string
 *                 enum: [ping, wave]
 *                 description: The type of entity these files will be attached to
 *     responses:
 *       201:
 *         description: Files uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 media:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Media'
 *       400:
 *         description: No files provided or invalid file type
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: Upload service not configured
 */
export const uploadFiles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized: User or organization context missing' });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        error: 'Upload service not configured',
        message: 'File uploads are not available. Please contact the administrator.',
      });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const entityType = req.body.entityType as string | undefined;
    const subfolder = entityType === 'ping' ? 'pings' : entityType === 'wave' ? 'waves' : 'general';

    // Upload all files to Cloudinary
    const uploadResults = await uploadMultipleToCloudinary(
      files.map((f) => ({ buffer: f.buffer, filename: f.originalname })),
      { folder: getOrganizationFolder(organizationId, subfolder) }
    );

    // Create media records in database
    const mediaRecords = await prisma.$transaction(
      uploadResults.map((result, index) =>
        prisma.media.create({
          data: {
            url: result.url,
            publicId: result.publicId,
            filename: files[index].originalname,
            mimeType: files[index].mimetype,
            size: result.size,
            width: result.width,
            height: result.height,
            organizationId,
          },
        })
      )
    );

    logger.info('Files uploaded', {
      userId,
      organizationId,
      count: mediaRecords.length,
      mediaIds: mediaRecords.map((m) => m.id),
    });

    return res.status(201).json({
      media: mediaRecords.map((m) => ({
        id: m.id,
        url: m.url,
        filename: m.filename,
        mimeType: m.mimeType,
        size: m.size,
        width: m.width,
        height: m.height,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Upload error', { error });
    next(error);
  }
};

/**
 * @swagger
 * /api/uploads/profile:
 *   post:
 *     summary: Upload profile picture
 *     description: Upload a profile picture for the current user. Automatically resizes and crops to fit.
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     profilePicture:
 *                       type: string
 *       400:
 *         description: No file provided
 *       401:
 *         description: Unauthorized
 */
export const uploadProfilePicture = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized: User or organization context missing' });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        error: 'Upload service not configured',
        message: 'File uploads are not available. Please contact the administrator.',
      });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Upload with profile-specific transformations
    const result = await uploadForProfile(file.buffer, file.originalname, organizationId);

    // Create media record linked to user
    const media = await prisma.media.create({
      data: {
        url: result.url,
        publicId: result.publicId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: result.size,
        width: result.width,
        height: result.height,
        organizationId,
        userId,
      },
    });

    // Update user's profilePicture field
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: result.url },
      select: { id: true, profilePicture: true },
    });

    logger.info('Profile picture uploaded', { userId, mediaId: media.id });

    return res.status(200).json({
      url: result.url,
      mediaId: media.id,
      user: updatedUser,
    });
  } catch (error) {
    logger.error('Profile upload error', { error });
    next(error);
  }
};

/**
 * @swagger
 * /api/uploads/{id}:
 *   delete:
 *     summary: Delete an uploaded file
 *     description: Delete a media file by ID. Only the uploader or admin can delete.
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       404:
 *         description: Media not found
 *       403:
 *         description: Not authorized to delete this file
 */
export const deleteMedia = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.role;
    const mediaId = parseInt(req.params.id, 10);

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (isNaN(mediaId)) {
      return res.status(400).json({ error: 'Invalid media ID' });
    }

    // Find the media record
    const media = await prisma.media.findFirst({
      where: {
        id: mediaId,
        organizationId,
      },
    });

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Check authorization: owner, admin, or super_admin
    const isOwner = media.userId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this file' });
    }

    // Delete from Cloudinary
    const resourceType = media.mimeType.startsWith('video/') ? 'video' : 'image';
    await deleteFromCloudinary(media.publicId, resourceType);

    // Delete from database
    await prisma.media.delete({ where: { id: mediaId } });

    logger.info('Media deleted', { mediaId, userId, deletedBy: isOwner ? 'owner' : 'admin' });

    return res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    logger.error('Delete media error', { error });
    next(error);
  }
};

/**
 * @swagger
 * /api/uploads/attach:
 *   post:
 *     summary: Attach media to a ping or wave
 *     description: Link previously uploaded media files to a ping or wave
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mediaIds
 *               - entityType
 *               - entityId
 *             properties:
 *               mediaIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               entityType:
 *                 type: string
 *                 enum: [ping, wave]
 *               entityId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Media attached successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Entity not found
 */
export const attachMediaToEntity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;
    const { mediaIds, entityType, entityId } = req.body;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return res.status(400).json({ error: 'mediaIds must be a non-empty array' });
    }

    if (!['ping', 'wave'].includes(entityType)) {
      return res.status(400).json({ error: 'entityType must be "ping" or "wave"' });
    }

    if (!entityId || typeof entityId !== 'number') {
      return res.status(400).json({ error: 'entityId must be a number' });
    }

    // Verify the entity exists and belongs to the user's organization
    if (entityType === 'ping') {
      const ping = await prisma.ping.findFirst({
        where: { id: entityId, organizationId },
      });
      if (!ping) {
        return res.status(404).json({ error: 'Ping not found' });
      }
    } else {
      const wave = await prisma.wave.findFirst({
        where: { id: entityId, organizationId },
      });
      if (!wave) {
        return res.status(404).json({ error: 'Wave not found' });
      }
    }

    // Update media records to link to the entity
    const updateData = entityType === 'ping'
      ? { pingId: entityId }
      : { waveId: entityId };

    const updatedMedia = await prisma.media.updateMany({
      where: {
        id: { in: mediaIds },
        organizationId,
        // Only update unattached media (no ping or wave)
        pingId: null,
        waveId: null,
      },
      data: updateData,
    });

    logger.info('Media attached to entity', {
      userId,
      entityType,
      entityId,
      mediaCount: updatedMedia.count,
    });

    return res.status(200).json({
      message: 'Media attached successfully',
      attachedCount: updatedMedia.count,
    });
  } catch (error) {
    logger.error('Attach media error', { error });
    next(error);
  }
};

/**
 * @swagger
 * /api/uploads/ping/{pingId}:
 *   get:
 *     summary: Get media for a ping
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pingId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Media list for the ping
 */
export const getMediaForPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user?.organizationId;
    const pingId = parseInt(req.params.pingId, 10);

    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (isNaN(pingId)) {
      return res.status(400).json({ error: 'Invalid ping ID' });
    }

    const media = await prisma.media.findMany({
      where: { pingId, organizationId },
      select: {
        id: true,
        url: true,
        filename: true,
        mimeType: true,
        size: true,
        width: true,
        height: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({ media });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/uploads/wave/{waveId}:
 *   get:
 *     summary: Get media for a wave
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waveId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Media list for the wave
 */
export const getMediaForWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user?.organizationId;
    const waveId = parseInt(req.params.waveId, 10);

    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (isNaN(waveId)) {
      return res.status(400).json({ error: 'Invalid wave ID' });
    }

    const media = await prisma.media.findMany({
      where: { waveId, organizationId },
      select: {
        id: true,
        url: true,
        filename: true,
        mimeType: true,
        size: true,
        width: true,
        height: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({ media });
  } catch (error) {
    next(error);
  }
};
