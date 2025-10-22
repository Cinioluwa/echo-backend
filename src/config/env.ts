// src/config/env.ts
import { z } from 'zod';
// Avoid importing logger here to prevent circular deps during bootstrap

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // JWT
  JWT_SECRET: z.string().min(4, 'JWT_SECRET must be at least 4 characters'),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables at startup.
 * Throws an error if validation fails.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues.map(
      (err) => `${err.path.join('.')}: ${err.message}`
    );
    // Use console to avoid logger dependency here
    console.error('Environment validation failed:', errors);
    throw new Error(`Invalid environment variables:\n${errors.join('\n')}`);
  }
  // Keep logs quiet in production
  if (result.data.NODE_ENV !== 'production') {
    console.info('Environment variables validated successfully');
  }
  return result.data;
}

// Export validated env for use throughout the app
export const env = validateEnv();
