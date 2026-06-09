import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types/AuthRequest.js';

type GuestJwtPayload = {
  guestUserId: number;
  organizationId: number;
  role: 'GUEST';
  iat?: number;
  exp?: number;
};

const guestAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as GuestJwtPayload;
    
    if (decoded.role !== 'GUEST') {
        return res.status(403).json({ error: 'Forbidden: Invalid token type' });
    }

    // For Guest actions, we map guestUserId to userId so that existing 
    // organizationMiddleware or logic can function if needed, but it's better to 
    // be explicit. We'll attach guest to req.
    (req as any).guest = {
      guestUserId: decoded.guestUserId,
      organizationId: decoded.organizationId,
      role: decoded.role,
    };
    
    // We also set req.organizationId so that organization middleware works correctly
    (req as AuthRequest).organizationId = decoded.organizationId;
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export default guestAuthMiddleware;
