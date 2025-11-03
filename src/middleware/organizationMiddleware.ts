import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/AuthRequest.js';

const organizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;

  if (!authReq.user) {
    return res.status(400).json({ error: 'Bad Request: Organization context missing' });
  }

  if (authReq.user.role === 'SUPER_ADMIN') {
    const overrideHeader = req.headers['x-organization-id'];
    const overrideQuery = req.query.organizationId;
    const resolved = overrideHeader ?? overrideQuery;

    if (!resolved) {
      return res.status(400).json({
        error: 'SUPER_ADMIN must specify an organization via x-organization-id header or organizationId query param',
      });
    }

    const organizationId = Number(resolved);
    if (Number.isNaN(organizationId)) {
      return res.status(400).json({ error: 'Invalid organization identifier supplied' });
    }

    (req as any).organizationId = organizationId;
    return next();
  }

  if (!authReq.user.organizationId) {
    return res.status(400).json({ error: 'Bad Request: Organization context missing' });
  }

  // Attach organizationId directly to req for easy access in controllers
  (req as any).organizationId = authReq.user.organizationId;

  next();
};

export default organizationMiddleware;