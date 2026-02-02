// src/routes/uploadRoutes.ts
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  uploadMedia,
  uploadImage,
  handleMulterError,
  requireFile,
} from '../middleware/uploadMiddleware.js';
import {
  uploadFiles,
  uploadProfilePicture,
  deleteMedia,
  attachMediaToEntity,
  getMediaForPing,
  getMediaForWave,
} from '../controllers/uploadController.js';
import {
  attachMediaSchema,
  mediaIdParamSchema,
  pingIdParamSchema,
  waveIdParamSchema,
} from '../schemas/uploadSchema.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Uploads
 *     description: File upload and media management endpoints
 */

/**
 * @openapi
 * /api/uploads:
 *   post:
 *     summary: Upload media files
 *     description: |
 *       Upload one or more media files (images, videos, PDFs).
 *       Returns media IDs that can be attached to pings or waves.
 *       
 *       **Supported formats:**
 *       - Images: JPEG, PNG, GIF, WebP (max 5MB each)
 *       - Videos: MP4, WebM, QuickTime (max 50MB each)
 *       - Documents: PDF (max 10MB)
 *       
 *       **Limits:** Maximum 5 files per request
 *     tags:
 *       - Uploads
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
 *                 description: Files to upload (max 5)
 *               entityType:
 *                 type: string
 *                 enum: [ping, wave]
 *                 description: Optional hint for organizing uploads
 *     responses:
 *       201:
 *         description: Files uploaded successfully
 *       400:
 *         description: Invalid file or no files provided
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: Upload service not configured
 */
router.post(
  '/',
  authMiddleware,
  organizationMiddleware,
  uploadMedia.array('files', 5),
  handleMulterError,
  requireFile,
  uploadFiles
);

/**
 * @openapi
 * /api/uploads/profile:
 *   post:
 *     summary: Upload profile picture
 *     description: |
 *       Upload a new profile picture for the current user.
 *       The image is automatically resized to 400x400 and cropped to face.
 *       
 *       **Supported formats:** JPEG, PNG, GIF, WebP (max 5MB)
 *     tags:
 *       - Uploads
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
 *       400:
 *         description: No file provided or invalid file type
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/profile',
  authMiddleware,
  organizationMiddleware,
  uploadImage.single('file'),
  handleMulterError,
  requireFile,
  uploadProfilePicture
);

/**
 * @openapi
 * /api/uploads/attach:
 *   post:
 *     summary: Attach media to a ping or wave
 *     description: |
 *       Link previously uploaded media files to a ping or wave.
 *       Media can only be attached once and must belong to the same organization.
 *     tags:
 *       - Uploads
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
 *                 example: [1, 2, 3]
 *               entityType:
 *                 type: string
 *                 enum: [ping, wave]
 *               entityId:
 *                 type: integer
 *                 example: 42
 *     responses:
 *       200:
 *         description: Media attached successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Entity not found
 */
router.post(
  '/attach',
  authMiddleware,
  organizationMiddleware,
  validate(attachMediaSchema),
  attachMediaToEntity
);

/**
 * @openapi
 * /api/uploads/{id}:
 *   delete:
 *     summary: Delete an uploaded file
 *     description: |
 *       Delete a media file by ID.
 *       Only the original uploader or an admin can delete files.
 *     tags:
 *       - Uploads
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Media ID
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       403:
 *         description: Not authorized to delete this file
 *       404:
 *         description: Media not found
 */
router.delete(
  '/:id',
  authMiddleware,
  organizationMiddleware,
  validate(mediaIdParamSchema),
  deleteMedia
);

/**
 * @openapi
 * /api/uploads/ping/{pingId}:
 *   get:
 *     summary: Get media attached to a ping
 *     description: Retrieve all media files attached to a specific ping.
 *     tags:
 *       - Uploads
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pingId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ping ID
 *     responses:
 *       200:
 *         description: Media list for the ping
 *       400:
 *         description: Invalid ping ID
 */
router.get(
  '/ping/:pingId',
  authMiddleware,
  organizationMiddleware,
  validate(pingIdParamSchema),
  getMediaForPing
);

/**
 * @openapi
 * /api/uploads/wave/{waveId}:
 *   get:
 *     summary: Get media attached to a wave
 *     description: Retrieve all media files attached to a specific wave.
 *     tags:
 *       - Uploads
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waveId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Wave ID
 *     responses:
 *       200:
 *         description: Media list for the wave
 *       400:
 *         description: Invalid wave ID
 */
router.get(
  '/wave/:waveId',
  authMiddleware,
  organizationMiddleware,
  validate(waveIdParamSchema),
  getMediaForWave
);

export default router;
