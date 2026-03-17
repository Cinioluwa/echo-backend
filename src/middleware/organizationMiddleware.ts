import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/AuthRequest.js';

const organizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  console.log(`DEBUG: organizationMiddleware [${req.method}] ${req.originalUrl}`, { 
    user: authReq.user,
    organizationId: (req as any).organizationId 
  });

  if (!authReq.user) {
    console.log('DEBUG: organizationMiddleware: returning 400 - no user');
    return res.status(400).json({ error: 'Bad Request: Organization context missing' });
  }

  if (authReq.user.role === 'SUPER_ADMIN') {
    const overrideHeader = req.headers['x-organization-id'];
    const overrideQuery = req.query.organizationId;
    const resolved = overrideHeader ?? overrideQuery;

    if (!resolved) {
      console.log('DEBUG: organizationMiddleware: returning 400 - SUPER_ADMIN no resolved org');
      return res.status(400).json({
        error: 'SUPER_ADMIN must specify an organization via x-organization-id header or organizationId query param',
      });
    }

    const organizationId = Number(resolved);
    if (Number.isNaN(organizationId)) {
      console.log('DEBUG: organizationMiddleware: returning 400 - invalid org identifier');
      return res.status(400).json({ error: 'Invalid organization identifier supplied' });
    }

    (req as any).organizationId = organizationId;
    return next();
  }

  if (!authReq.user.organizationId) {
    console.log('DEBUG: organizationMiddleware: returning 400 - no organizationId on user', { user: authReq.user });
    return res.status(400).json({ error: 'Bad Request: Organization context missing' });
  }

  // Attach organizationId directly to req for easy access in controllers
  (req as any).organizationId = authReq.user.organizationId;

  console.log('DEBUG: organizationMiddleware: success, calling next()', { organizationId: (req as any).organizationId });
  next();
};

export default organizationMiddleware;