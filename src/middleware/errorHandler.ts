// src/middleware/errorHandler.ts
import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger.js';

export default function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as any).requestId;

  // Ensure request id is visible to clients even on errors.
  if (requestId) {
    res.setHeader('x-request-id', requestId);
  }

  // Log error with context
  logger.error('Error caught by error handler', {
    requestId,
    method: req.method,
    url: req.url,
    error: err instanceof Error ? {
      name: err.name,
      message: err.message,
      stack: err.stack,
    } : err,
  });
  
  // Check if it's a Prisma error
  const isPrismaError = typeof err === 'object' && err !== null && (err as any).code;

  // Prisma client errors that don't carry a `.code`
  if (err instanceof Error) {
    if (err.name === 'PrismaClientValidationError') {
      // e.g. wrong types passed to Prisma (string instead of int)
      return res.status(400).json({
        error: 'Invalid request data.',
        code: 'PRISMA_VALIDATION_ERROR',
        requestId,
      });
    }
    if (err.name === 'PrismaClientInitializationError') {
      // e.g. DB unreachable / bad connection string / migrations not applied
      return res.status(503).json({
        error: 'Database is temporarily unavailable. Please try again shortly.',
        code: 'PRISMA_INITIALIZATION_ERROR',
        requestId,
      });
    }
    if (err.name === 'PrismaClientRustPanicError') {
      return res.status(500).json({
        error: 'Database engine error. Please try again later.',
        code: 'PRISMA_RUST_PANIC',
        requestId,
      });
    }
  }

  if (isPrismaError) {
    const prismaError = err as any;
    
    // Unique constraint violation (P2002)
    if (prismaError.code === 'P2002') {
      const field = prismaError.meta?.target?.[0] || 'field';
      return res.status(409).json({ 
        error: `This ${field} is already in use. Please use a different one.`,
        code: 'PRISMA_P2002',
        requestId,
      });
    }
    
    // Record not found (P2025)
    if (prismaError.code === 'P2025') {
      return res.status(404).json({ 
        error: 'The requested resource was not found.',
        code: 'PRISMA_P2025',
        requestId,
      });
    }

    // Table/column missing (usually migrations not applied) (P2021/P2022)
    if (prismaError.code === 'P2021' || prismaError.code === 'P2022') {
      return res.status(500).json({
        error: 'Server database schema is not ready for this request.',
        code: prismaError.code === 'P2021' ? 'PRISMA_P2021' : 'PRISMA_P2022',
        requestId,
      });
    }
    
    // Foreign key constraint failed (P2003)
    if (prismaError.code === 'P2003') {
      return res.status(400).json({ 
        error: 'Invalid reference: The related item does not exist.',
        code: 'PRISMA_P2003',
        requestId,
      });
    }
    
    // Required field missing (P2011)
    if (prismaError.code === 'P2011') {
      const field = prismaError.meta?.constraint || 'field';
      return res.status(400).json({ 
        error: `Required field is missing: ${field}`,
        code: 'PRISMA_P2011',
        requestId,
      });
    }
  }

  // JWT errors
  if (err instanceof Error) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token.', code: 'JWT_INVALID', requestId });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session has expired. Please log in again.', code: 'JWT_EXPIRED', requestId });
    }
  }

  // Default fallback
  const message = err instanceof Error ? err.message : 'Something went wrong on our end. Please try again later.';
  
  // In development, return full error details
  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({ 
      error: message,
      details: err instanceof Error ? err.stack : undefined,
      requestId,
    });
  }
  
  // In production, hide implementation details
  return res.status(500).json({ error: 'Something went wrong on our end. Please try again later.', requestId });
}
