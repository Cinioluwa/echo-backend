import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/AuthRequest.js';

const organizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;

  if (!authReq.user || !authReq.user.organizationId) {
    return res.status(400).json({ error: 'Bad Request: Organization context missing' });
  }

  // Attach organizationId directly to req for easy access in controllers
  (req as any).organizationId = authReq.user.organizationId;

  next();
};

export default organizationMiddleware;