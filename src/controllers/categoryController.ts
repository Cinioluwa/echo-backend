import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

// GET /api/categories?q=Academic
export const getCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user?.organizationId ?? (req as any).organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context missing' });
    }

    const q = (req.query.q as string) || '';

    const categories = await prisma.category.findMany({
      where: {
        organizationId,
        ...(q
          ? {
            name: {
              contains: q,
              mode: 'insensitive',
            },
          }
          : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    return res.status(200).json({ data: categories });
  } catch (error) {
    return next(error);
  }
};

export const createCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    const organizationId = req.user?.organizationId ?? (req as any).organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context missing' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        organizationId,
      },
    });

    return res.status(201).json(category);
  } catch (error) {
    return next(error);
  }
};

export default { getCategories };
