import { Request } from 'express';
import type { Role } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    organizationId: number;
    role: Role;
  };
  organizationId?: number; // Add for convenience
}
