// src/middleware/uploadMiddleware.ts
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

// Allowed MIME types for different upload contexts
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
];

export const ALLOWED_MEDIA_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
];

// File size limits
const MAX_FILE_SIZE = (env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024; // Default 10MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for videos

// Configure multer with memory storage (for Cloudinary upload)
const storage = multer.memoryStorage();

// File filter function
const createFileFilter = (allowedTypes: string[]) => {
  return (
    _req: Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback
  ) => {
    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
    }
  };
};

// General media upload (images, videos, PDFs)
export const uploadMedia = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Max 5 files per request
  },
  fileFilter: createFileFilter(ALLOWED_MEDIA_TYPES),
});

// Image-only upload (for profile pictures)
export const uploadImage = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES),
});

// Video upload with larger limit
export const uploadVideo = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter(ALLOWED_VIDEO_TYPES),
});

// Error handling middleware for multer errors
export const handleMulterError = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          error: 'File too large',
          message: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          error: 'Too many files',
          message: 'Maximum 5 files allowed per upload',
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          error: 'Unexpected field',
          message: `Unexpected field name: ${err.field}`,
        });
        return;
      default:
        res.status(400).json({
          error: 'Upload error',
          message: err.message,
        });
        return;
    }
  }

  if (err.message.includes('Invalid file type')) {
    res.status(400).json({
      error: 'Invalid file type',
      message: err.message,
    });
    return;
  }

  next(err);
};

// Helper to check if file exists in request
export const requireFile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.file && (!req.files || (Array.isArray(req.files) && req.files.length === 0))) {
    res.status(400).json({
      error: 'No file uploaded',
      message: 'Please provide a file to upload',
    });
    return;
  }
  next();
};
