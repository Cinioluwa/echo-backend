// src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import logger, { sanitizeForLog } from '../config/logger.js';

// Generate unique request ID
const generateRequestId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Attach requestId to request object for use in other middlewares
  (req as any).requestId = requestId;

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: sanitizeForLog(req.body), // Don't log passwords, tokens, etc.
  });

  // Capture the original res.json to log responses
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Outgoing response', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });

    return originalJson(body);
  };

  next();
};
