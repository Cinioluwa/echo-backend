import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    organizationId: number;
  };
  organizationId?: number; // Add for convenience
}
