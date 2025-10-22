import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';

export const createPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, content, category, hashtag } = req.body;
    const authorId = req.user?.userId;
    
    if (!authorId) {
      return res.status(401).json({ error: 'Unauthorized: User ID not found' });
    }
    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Title, content and category are required' });
    }

    const newPing = await prisma.ping.create({
      data: {
        title,
        content,
        authorId,
        category,
        hashtag: hashtag || null,
      },
    });

    return res.status(201).json(newPing);
  } catch (error) {
    logger.error('Error creating ping', { error, authorId: req.user?.userId });
    return next(error);
  }
};

export const getAllPings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // --- Pagination Logic ---
    const page = parseInt(_req.query.page as string) || 1;
    let limit = parseInt(_req.query.limit as string) || 20;
    if (limit > 100) limit = 100; // Cap the limit to 100
    const skip = (page - 1) * limit;

    // --- Filtering Logic ---
    const { category, status } = _req.query;
    const whereClause: any = {};
    
    if (category) {
      whereClause.category = category;
    }
    if (status) {
      whereClause.status = status;
    }

    // Run two queries in parallel: one for the data, one for the total count
    const [pings, totalPings] = await prisma.$transaction([
      prisma.ping.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          author: {
            select: { 
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          // Include counts of related items
          _count: {
            select: { waves: true, comments: true, surges: true },
          },
        },
      }),
      prisma.ping.count({ where: whereClause }),
    ]);
    
    // --- Metadata Calculation ---
    const totalPages = Math.ceil(totalPings / limit);

    return res.status(200).json({
      data: pings,
      pagination: {
        totalPings,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching pings', { error });
    return next(error);
  }
};

export const getMyPings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // --- Pagination Logic (same as before) ---
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    // --- Filtering Logic (now includes authorId) ---
    const whereClause = { authorId: userId };

    const [pings, totalPings] = await prisma.$transaction([
      prisma.ping.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: { waves: true, comments: true, surges: true },
          },
        },
      }),
      prisma.ping.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalPings / limit);

    return res.status(200).json({
      data: pings,
      pagination: {
        totalPings,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching user pings', { error, userId: req.user?.userId });
    return next(error);
  }
};

export const searchPings = async (req: Request, res: Response, next: NextFunction) => {
  const { hashtag, q } = req.query;
  
  try {
    if (!hashtag && !q) {
      return res.status(400).json({ error: 'Please provide a search query (hashtag or q)' });
    }

    // --- Pagination Logic ---
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    // --- Search/Filtering Logic ---
    const whereClause: any = {};
    if (hashtag) {
      whereClause.hashtag = {
        contains: hashtag as string,
        mode: 'insensitive', // Makes the search case-insensitive
      };
    }
    if (q) {
      whereClause.OR = [
        { title: { contains: q as string, mode: 'insensitive' } },
        { content: { contains: q as string, mode: 'insensitive' } },
      ];
    }

    const [pings, totalPings] = await prisma.$transaction([
      prisma.ping.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { 
              id: true,
              email: true, 
              firstName: true, 
              lastName: true 
            },
          },
          _count: {
            select: { waves: true, comments: true, surges: true },
          },
        },
      }),
      prisma.ping.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalPings / limit);

    return res.status(200).json({
      data: pings,
      pagination: {
        totalPings,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error searching pings', { error, hashtag, query: q });
    return next(error);
  }
};

export const getPingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ping = await prisma.ping.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { 
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        waves: {
          include: {
            surges: true,
          },
        },
        comments: {
          include: {
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
        officialResponse: {
          include: {
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
      },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }
    return res.status(200).json(ping);
  } catch (error) {
    logger.error('Error fetching ping', { error, pingId: req.params.id });
    return next(error);
  }
};

export const deletePing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authorId = req.user?.userId;

    const ping = await prisma.ping.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    if (ping.authorId !== authorId) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own pings' });
    }

    await prisma.ping.delete({
      where: { id: parseInt(id) },
    });

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting ping', { error, pingId: req.params.id, userId: req.user?.userId });
    return next(error);
  }
};

export const updatePing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    if (!req.body) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    
    const { title, content, category, hashtag, status } = req.body;

    const ping = await prisma.ping.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    if (ping.authorId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this ping' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    if (hashtag !== undefined) updateData.hashtag = hashtag;
    if (status !== undefined) updateData.status = status;

    const updatedPing = await prisma.ping.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return res.status(200).json(updatedPing);
  } catch (error) {
    logger.error('Error updating ping', { error, pingId: req.params.id, userId: req.user?.userId });
    return next(error);
  }
};

export const updatePingStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["POSTED", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    const updatedPing = await prisma.ping.update({
      where: { id: parseInt(id) },
      data: {
        status: status,
      },
    });
    return res.status(200).json(updatedPing);
  } catch (error) {
    logger.error('Error updating ping status', { error, pingId: req.params.id });
    return next(error);
  }
};

export const submitPing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const updatedPing = await prisma.ping.update({
      where: { id: parseInt(id) },
      data: { status: 'SUBMITTED' },
    });

    return res.status(200).json(updatedPing);
  } catch (error) {
    logger.error('Error submitting ping', { error, pingId: req.params.id });
    return next(error);
  }
};

export const getAllPingsAsAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {

    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const { status } = req.query;
    const whereClause: any = {};
    if (status) {
      whereClause.status = status as any;
    }

    const [pings, totalPings] = await prisma.$transaction([
      prisma.ping.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          author: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { waves: true, comments: true, surges: true },
          },
        },
      }),
      prisma.ping.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalPings / limit);

    return res.status(200).json({
      data: pings,
      pagination: {
        totalPings,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    logger.error('Error fetching all pings as admin', { error });
    return next(error);
  }
};