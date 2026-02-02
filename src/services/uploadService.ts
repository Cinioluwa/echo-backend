// src/services/uploadService.ts
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

// Configure Cloudinary
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format: string;
  size: number;
}

export interface UploadOptions {
  folder?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: Record<string, unknown>;
  allowedFormats?: string[];
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/**
 * Upload a file buffer to Cloudinary
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
  }

  const { folder = 'echo-uploads', resourceType = 'auto', transformation, allowedFormats } = options;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        allowed_formats: allowedFormats,
        transformation,
        public_id: `${Date.now()}-${filename.replace(/\.[^/.]+$/, '')}`, // Remove extension
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          logger.error('Cloudinary upload error', { error: error.message, filename });
          reject(new Error(`Upload failed: ${error.message}`));
          return;
        }

        if (!result) {
          reject(new Error('Upload failed: No result returned'));
          return;
        }

        logger.info('File uploaded to Cloudinary', {
          publicId: result.public_id,
          url: result.secure_url,
          size: result.bytes,
        });

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary
 */
export async function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<boolean> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    logger.info('File deleted from Cloudinary', { publicId, result: result.result });
    return result.result === 'ok';
  } catch (error) {
    logger.error('Cloudinary delete error', { publicId, error });
    throw error;
  }
}

/**
 * Upload multiple files to Cloudinary
 */
export async function uploadMultipleToCloudinary(
  files: Array<{ buffer: Buffer; filename: string }>,
  options: UploadOptions = {}
): Promise<UploadResult[]> {
  const uploadPromises = files.map((file) =>
    uploadToCloudinary(file.buffer, file.filename, options)
  );
  return Promise.all(uploadPromises);
}

/**
 * Get organization-specific folder path
 */
export function getOrganizationFolder(organizationId: number, subfolder?: string): string {
  const base = `echo-uploads/org-${organizationId}`;
  return subfolder ? `${base}/${subfolder}` : base;
}

/**
 * Upload for specific entity types with organization scoping
 */
export async function uploadForPing(
  buffer: Buffer,
  filename: string,
  organizationId: number
): Promise<UploadResult> {
  return uploadToCloudinary(buffer, filename, {
    folder: getOrganizationFolder(organizationId, 'pings'),
  });
}

export async function uploadForWave(
  buffer: Buffer,
  filename: string,
  organizationId: number
): Promise<UploadResult> {
  return uploadToCloudinary(buffer, filename, {
    folder: getOrganizationFolder(organizationId, 'waves'),
  });
}

export async function uploadForProfile(
  buffer: Buffer,
  filename: string,
  organizationId: number
): Promise<UploadResult> {
  return uploadToCloudinary(buffer, filename, {
    folder: getOrganizationFolder(organizationId, 'profiles'),
    resourceType: 'image',
    transformation: {
      width: 400,
      height: 400,
      crop: 'fill',
      gravity: 'face',
    },
  });
}
