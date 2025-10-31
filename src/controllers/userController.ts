// src/controllers/userController.ts
import { NextFunction, Request, Response } from 'express';
import prisma from '../config/db.js'; // Import our central prisma client
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';
// Even though this is a TypeScript file, when using moduleResolution "node16"/"nodenext" with ESM,
// relative imports must include the .js extension to match the emitted JavaScript files.
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, level, organizationDomain } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || email.trim() === '' || password.trim() === '') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (typeof firstName !== 'string' || typeof lastName !== 'string' || firstName.trim() === '' || lastName.trim() === '') {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    if (!organizationDomain) {
      return res.status(400).json({ error: 'Organization domain is required' });
    }

    // Find organization by domain
    const organization = await prisma.organization.findUnique({ where: { domain: organizationDomain } });
    if (!organization) {
      return res.status(400).json({ error: 'Invalid organization domain' });
    }

    // Check if user already exists in the org
    const existingUser = await prisma.user.findUnique({ where: { email_organizationId: { email, organizationId: organization.id } } });
    if (existingUser) {
      return res.status(409).json({ 
        error: 'An account with this email already exists in this organization. Please use a different email or try logging in.' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        firstName: firstName,
        lastName: lastName,
        level: level, // Include level if provided
        organizationId: organization.id,
      },
    });

    logger.info('New user registered', {
      userId: newUser.id,
      email: newUser.email,
      organizationId: newUser.organizationId,
      requestId: (req as any).requestId,
    });

    const { password: _pw, ...safeUser } = newUser as any;
    return res.status(201).json({ message: 'User created successfully', user: safeUser });
  } catch (error) {
    return next(error);
  }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, organizationDomain } = req.body;

    if (!organizationDomain) {
      return res.status(400).json({ error: 'Organization domain is required' });
    }

    // Find organization by domain
    const organization = await prisma.organization.findUnique({ where: { domain: organizationDomain } });
    if (!organization) {
      return res.status(400).json({ error: 'Invalid organization domain' });
    }

    const user = await prisma.user.findUnique({ where: { email_organizationId: { email, organizationId: organization.id } } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logger.warn('Failed login attempt', {
        email,
        organizationId: organization.id,
        requestId: (req as any).requestId,
      });
      return res.status(401).json({ error: 'Invalid email, password, or organization' });
    }

    const token = jwt.sign(
      { 
        userId: user.id,
        organizationId: user.organizationId // Add organizationId to JWT
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    logger.info('User logged in', {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      requestId: (req as any).requestId,
    });

    return res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    return next(error); // removed res.status(500).json(...) to avoid double-send
  }
};

export const deleteCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID not found' });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export const updateCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { firstName, lastName, level } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, level },
    });
    const { password: _pw, ...safeUser } = updatedUser;

    return res.status(200).json({ user: safeUser });
  } catch (error) {
    return next(error);
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        level: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (error) {
    logger.error('Error fetching user', { error, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get all surges (likes) by the current user
// @route   GET /api/users/me/surges
// @access  Private
export const getMySurges = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const [surges, totalSurges] = await prisma.$transaction([
      prisma.surge.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ping: {
            select: {
              id: true,
              title: true,
              category: true,
              status: true,
              createdAt: true,
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          wave: {
            select: {
              id: true,
              solution: true,
              viewCount: true,
              createdAt: true,
              pingId: true,
            },
          },
        },
      }),
      prisma.surge.count({ where: { userId } }),
    ]);

    const totalPages = Math.ceil(totalSurges / limit);

    return res.status(200).json({
      data: surges,
      pagination: {
        totalSurges,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching user surges', { error, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get all comments by the current user
// @route   GET /api/users/me/comments
// @access  Private
export const getMyComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const [comments, totalComments] = await prisma.$transaction([
      prisma.comment.findMany({
        where: { authorId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ping: {
            select: {
              id: true,
              title: true,
              category: true,
              status: true,
              createdAt: true,
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          wave: {
            select: {
              id: true,
              solution: true,
              viewCount: true,
              createdAt: true,
              pingId: true,
            },
          },
        },
      }),
      prisma.comment.count({ where: { authorId: userId } }),
    ]);

    const totalPages = Math.ceil(totalComments / limit);

    return res.status(200).json({
      data: comments,
      pagination: {
        totalComments,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching user comments', { error, userId: req.user?.userId });
    return next(error);
  }
};
