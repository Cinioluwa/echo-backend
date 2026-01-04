import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/AuthRequest.js';
import prisma from '../config/db.js';

const superAdminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Super admins only' });
    }

    return next();
  } catch (error) {
    return next(error as any);
  }
};

export default superAdminMiddleware;
