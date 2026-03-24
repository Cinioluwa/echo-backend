// src/config/cors.ts
import { env } from './env.js';

/**
 * Default allowed origins for CORS.
 * These are used if ALLOWED_ORIGINS environment variable is not set.
 */
export const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://echo-ng.vercel.app',
  'https://echo-ng.com',
  'https://www.echo-ng.com',
  'https://tryecho.online',
  'https://webapp-echo.vercel.app',
  'https://app.echo-ng.com',
  'https://echo-frontend.vercel.app',
  'https://echo-ng.onrender.com',
  'https://echo-backend-production-5186.up.railway.app',
];

/**
 * Resolves the final list of allowed origins and cleans them.
 */
export const getAllowedOrigins = (): string[] => {
  const origins = env.ALLOWED_ORIGINS || defaultAllowedOrigins;
  // Ensure no trailing slashes in the comparison list
  return origins.map((o) => o.replace(/\/$/, ''));
};

