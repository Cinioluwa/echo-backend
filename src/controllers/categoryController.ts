import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';
import { invalidateCacheAfterMutation } from '../utils/cacheInvalidation.js';

// GET /api/categories?q=Academic
export const getCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = (req as any).organizationId ?? req.user?.organizationId;
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
      orderBy: { id: 'asc' }, // Temporary, will sort in code
      select: { id: true, name: true },
    });

    // Sort with 'General' first, then alphabetical
    categories.sort((a, b) => {
      if (a.name === 'General') return -1;
      if (b.name === 'General') return 1;
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({ data: categories });
  } catch (error) {
    return next(error);
  }
};

export const createCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    const organizationId = (req as any).organizationId ?? req.user?.organizationId;
    const role = req.user?.role;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context missing' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Only organization leadership can customize categories.',
        code: 'CATEGORY_CUSTOMIZATION_FORBIDDEN',
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        isClaimVerified: true,
        categoryCustomizationLocked: true,
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!organization.isClaimVerified || organization.categoryCustomizationLocked) {
      return res.status(403).json({
        error: 'Category customization is locked until organization leadership is verified.',
        code: 'ORG_CLAIM_VERIFICATION_REQUIRED',
      });
    }

    const category = await prisma.category.create({
      data: {
        name,
        organizationId,
      },
    });

    // Invalidate cache after creating category
    await invalidateCacheAfterMutation(organizationId);

    return res.status(201).json(category);
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/categories/:id — rename or toggle isActive
export const updateCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseInt(req.params.id);
    const organizationId = (req as any).organizationId ?? req.user?.organizationId;
    const role = req.user?.role;

    if (!organizationId) return res.status(400).json({ error: 'Organization context missing' });
    if (Number.isNaN(categoryId)) return res.status(400).json({ error: 'Invalid category ID' });

    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only organization leadership can manage categories.', code: 'CATEGORY_CUSTOMIZATION_FORBIDDEN' });
    }

    const { name, isActive } = req.body as { name?: string; isActive?: boolean };
    if (name === undefined && isActive === undefined) {
      return res.status(400).json({ error: 'At least one of name or isActive must be provided.' });
    }

    // Ensure category belongs to this org
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, organizationId },
      select: { id: true, name: true },
    });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    // If renaming, check uniqueness within org
    if (name && name !== existing.name) {
      const conflict = await prisma.category.findFirst({
        where: { name, organizationId, NOT: { id: categoryId } },
        select: { id: true },
      });
      if (conflict) return res.status(409).json({ error: 'A category with that name already exists.' });
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
      },
      select: { id: true, name: true, isActive: true, sortOrder: true, organizationId: true },
    });

    await invalidateCacheAfterMutation(organizationId);
    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/categories/:id
export const deleteCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseInt(req.params.id);
    const organizationId = (req as any).organizationId ?? req.user?.organizationId;
    const role = req.user?.role;

    if (!organizationId) return res.status(400).json({ error: 'Organization context missing' });
    if (Number.isNaN(categoryId)) return res.status(400).json({ error: 'Invalid category ID' });

    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only organization leadership can delete categories.', code: 'CATEGORY_CUSTOMIZATION_FORBIDDEN' });
    }

    const existing = await prisma.category.findFirst({
      where: { id: categoryId, organizationId },
      select: { id: true, _count: { select: { pings: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    if (existing._count.pings > 0) {
      return res.status(409).json({
        error: `Cannot delete a category that has ${existing._count.pings} ping(s) associated with it.`,
        code: 'CATEGORY_HAS_PINGS',
        pingCount: existing._count.pings,
      });
    }

    await prisma.category.delete({ where: { id: categoryId } });
    await invalidateCacheAfterMutation(organizationId);

    return res.status(200).json({ message: 'Category deleted successfully.', categoryId });
  } catch (error) {
    return next(error);
  }
};

export default { getCategories };
