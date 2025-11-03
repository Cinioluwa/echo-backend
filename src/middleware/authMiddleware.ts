import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';
import type { Role } from '@prisma/client';

// Adding a 'user' property to the Express Request type
// Keep global augmentation minimal or rely on AuthRequest type in controllers.
// Here we define the expected JWT payload shape.
type JwtPayload = {
  userId: number;
  organizationId: number;
  role: Role;
  iat?: number;
  exp?: number;
};

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        organizationId: true,
        role: true,
        status: true,
        organization: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Unauthorized: Account inactive' });
    }

    if (
      user.organization &&
      user.organization.status !== 'ACTIVE' &&
      user.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({ error: 'Organization is not active' });
    }

    (req as AuthRequest).user = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    };
    next(); // Proceed to the next function (the controller)
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export default authMiddleware;