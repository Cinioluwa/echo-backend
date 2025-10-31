import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types/AuthRequest.js';

// Adding a 'user' property to the Express Request type
// Keep global augmentation minimal or rely on AuthRequest type in controllers.
// Here we define the expected JWT payload shape.
type JwtPayload = {
  userId: number;
  organizationId: number;
  iat?: number;
  exp?: number;
};

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    (req as AuthRequest).user = { userId: decoded.userId, organizationId: decoded.organizationId }; // attach organizationId
    next(); // Proceed to the next function (the controller)
  } catch (_error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export default authMiddleware;