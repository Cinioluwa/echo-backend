// src/config/logger.ts
import winston from 'winston';

const { combine, timestamp, printf, colorize, align, json, errors } = winston.format;

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Custom format for development (human-readable with colors)
const devFormat = combine(
  colorize({ all: true }),
  timestamp({
    format: 'YYYY-MM-DD hh:mm:ss.SSS A',
  }),
  align(),
  printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

// Production format (structured JSON for cloud logging)
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }), // Include stack traces
  json()
);

// Create the logger
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug', // More verbose in dev
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'echo-backend' }, // Add service name to all logs
  transports: [
    // Always log to console
    new winston.transports.Console({
      stderrLevels: ['error'], // Errors go to stderr
    }),
    
    // Log all errors to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5, // Keep 5 files
    }),
    
    // Log everything (info and above) to combined.log in production
    ...(isProduction ? [
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    ] : []),
  ],
});

// Helper to sanitize sensitive data from logs
export const sanitizeForLog = (data: any): any => {
  if (data === undefined || data === null) return data;

  const sensitive = ['password', 'token', 'authorization', 'cookie', 'secret'];

  const mask = (value: any): any => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(mask);
    if (typeof value === 'object') {
      const out: any = {};
      for (const key of Object.keys(value)) {
        if (sensitive.some(s => key.toLowerCase().includes(s))) {
          out[key] = '[REDACTED]';
        } else {
          out[key] = mask(value[key]);
        }
      }
      return out;
    }
    // For unexpected types, return as-is
    return value;
  };

  try {
    return mask(data);
  } catch (_err) {
    // If sanitization fails for any reason, avoid leaking sensitive data
    return '[REDACTED]';
  }
};

export default logger;
