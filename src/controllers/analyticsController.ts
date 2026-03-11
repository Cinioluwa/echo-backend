// src/controllers/analyticsController.ts
import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';
import { Status, ProgressStatus } from '@prisma/client';

// @desc    Get admin overview analytics
// @route   GET /api/analytics/admin/overview
// @access  Private
export const getAdminOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const organizationId = req.organizationId;
  if (!organizationId) {
    return res.status(401).json({ error: 'Organization ID missing' });
  }

  try {
    const totalWaves = await prisma.wave.count({ where: { organizationId }});
    const pingsSubmitted = await prisma.ping.count({ where: { organizationId, status: 'POSTED' }});
    const wavesUnderReview = await prisma.wave.count({ where: { organizationId, status: 'UNDER_REVIEW' }});
    const activeUsers = await prisma.user.count({ where: { organizationId, status: 'ACTIVE' }});

    const now = new Date();
    
    // 30 days ago and 60 days ago bounds for percent change
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);

    const [currentWaves, currentPings, currentReviewWaves, currentUsers, prevWaves, prevPings, prevReviewWaves, prevUsers] = await prisma.$transaction([
      prisma.wave.count({ where: { organizationId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.ping.count({ where: { organizationId, status: 'POSTED', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.wave.count({ where: { organizationId, status: 'UNDER_REVIEW', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { organizationId, status: 'ACTIVE', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.wave.count({ where: { organizationId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.ping.count({ where: { organizationId, status: 'POSTED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.wave.count({ where: { organizationId, status: 'UNDER_REVIEW', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.user.count({ where: { organizationId, status: 'ACTIVE', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } })
    ]);

    const calcPercentChange = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100.00 : 0.00;
      return Number((((current - prev) / prev) * 100).toFixed(2));
    };

    // 6 Month Chart Data bounds
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const oneYearAndSixMonthsAgo = new Date(sixMonthsAgo);
    oneYearAndSixMonthsAgo.setFullYear(sixMonthsAgo.getFullYear() - 1);

    const [allUsers, allWaves, allSurges] = await prisma.$transaction([
      prisma.user.findMany({
        where: { organizationId, createdAt: { gte: oneYearAndSixMonthsAgo } },
        select: { createdAt: true }
      }),
      prisma.wave.findMany({
        where: { organizationId, createdAt: { gte: oneYearAndSixMonthsAgo } },
        select: { createdAt: true }
      }),
      prisma.surge.findMany({
        where: { organizationId, createdAt: { gte: oneYearAndSixMonthsAgo } },
        select: { createdAt: true }
      })
    ]);

    const chartData: {
      month: string;
      year: number;
      monthIndex: number;
      thisYear: { totalUsers: number; waves: number; surges: number };
      lastYear: { totalUsers: number; waves: number; surges: number };
    }[] = [];
    
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      chartData.push({
        month: shortMonths[d.getMonth()],
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        thisYear: { totalUsers: 0, waves: 0, surges: 0 },
        lastYear: { totalUsers: 0, waves: 0, surges: 0 }
      });
    }

    const bucketToChart = (items: { createdAt: Date }[], key: 'totalUsers' | 'waves' | 'surges') => {
      items.forEach(item => {
        const itemMonth = item.createdAt.getMonth();
        const itemYear = item.createdAt.getFullYear();

        const chartEntry = chartData.find(c => c.monthIndex === itemMonth);
        if (chartEntry) {
          if (itemYear === chartEntry.year) {
            chartEntry.thisYear[key] += 1;
          } else if (itemYear === chartEntry.year - 1) {
            chartEntry.lastYear[key] += 1;
          }
        }
      });
    };

    bucketToChart(allUsers, 'totalUsers');
    bucketToChart(allWaves, 'waves');
    bucketToChart(allSurges, 'surges');

    const formattedChartData = chartData.map(({ month, thisYear, lastYear }) => ({ month, thisYear, lastYear }));

    res.json({
      summaryCards: {
        waves: { total: totalWaves, percentChange: calcPercentChange(currentWaves, prevWaves) },
        pings: { total: pingsSubmitted, percentChange: calcPercentChange(currentPings, prevPings) },
        wavesUnderReview: { total: wavesUnderReview, percentChange: calcPercentChange(currentReviewWaves, prevReviewWaves) },
        activeUsers: { total: activeUsers, percentChange: calcPercentChange(currentUsers, prevUsers) },
      },
      chartData: formattedChartData
    });
  } catch (error) {
    logger.error('Error fetching admin overview', { error });
    next(error);
  }
};

// @desc    Get analytics by categories
// @route   GET /api/analytics/admin/categories
// @access  Private
// @returns Distribution of pings, waves, and resolved pings per category
export const getCategoryAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const organizationId = req.organizationId;
  if (!organizationId) {
    return res.status(401).json({ error: 'Organization ID missing' });
  }

  try {
    // Fetch all pings with their category
    const pings = await prisma.ping.findMany({
      where: { organizationId },
      include: { category: true }
    });

    // Fetch all waves with their associated ping category
    const waves = await prisma.wave.findMany({
      where: { organizationId },
      include: { ping: { include: { category: true } } }
    });

    const categoryStats: Record<string, { pings: number; waves: number; resolvedPings: number }> = {};
    let totalPings = 0;
    let totalWaves = 0;
    let totalResolvedPings = 0;

    pings.forEach(ping => {
      const catName = ping.category.name;
      if (!categoryStats[catName]) {
        categoryStats[catName] = { pings: 0, waves: 0, resolvedPings: 0 };
      }
      categoryStats[catName].pings += 1;
      totalPings++;
      
      // Use progressStatus for RESOLVED checks
      if ((ping.progressStatus as any) === 'RESOLVED') {
        categoryStats[catName].resolvedPings += 1;
        totalResolvedPings++;
      }
    });

    waves.forEach(wave => {
      const catName = wave.ping.category.name;
      if (!categoryStats[catName]) {
        categoryStats[catName] = { pings: 0, waves: 0, resolvedPings: 0 };
      }
      categoryStats[catName].waves += 1;
      totalWaves++;
    });

    const categoriesData = Object.entries(categoryStats).map(([category, stats]) => {
      return {
        category,
        pings: {
          count: stats.pings,
          percentage: totalPings > 0 ? (stats.pings / totalPings) * 100 : 0
        },
        waves: {
          count: stats.waves,
          percentage: totalWaves > 0 ? (stats.waves / totalWaves) * 100 : 0
        },
        resolvedPings: {
          count: stats.resolvedPings,
          percentage: totalResolvedPings > 0 ? (stats.resolvedPings / totalResolvedPings) * 100 : 0
        }
      };
    });

    res.json({
        totalPings,
        totalWaves,
        totalResolvedPings,
        categories: categoriesData
    });
  } catch (error) {
    logger.error('Error fetching category analytics', { error });
    next(error);
  }
};

// @desc    Get user level analytics for a ping
// @route   GET /api/analytics/pings/:id/levels
// @access  Private
export const getPingLevelAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const organizationId = req.organizationId;

  if (!organizationId) {
    return res.status(401).json({ error: 'Organization ID missing' });
  }

  try {
    const pingId = parseInt(id);

    // Get surges for ping
    const surges = await prisma.surge.findMany({
      where: { pingId, organizationId },
      include: { user: { select: { level: true } } }
    });

    // Get comments for ping
    const comments = await prisma.comment.findMany({
      where: { pingId, organizationId },
      include: { author: { select: { level: true } } }
    });

    // Get waves for ping
    const waves = await prisma.wave.findMany({
      where: { pingId, organizationId },
      include: { author: { select: { level: true } } }
    });

    const surgeBreakdown: Record<string, number> = {};
    const commentBreakdown: Record<string, number> = {};
    const waveBreakdown: Record<string, number> = {};

    surges.forEach(s => {
      const level = s.user.level?.toString() || 'Unknown';
      surgeBreakdown[level] = (surgeBreakdown[level] || 0) + 1;
    });

    comments.forEach(c => {
      const level = c.author.level?.toString() || 'Unknown';
      commentBreakdown[level] = (commentBreakdown[level] || 0) + 1;
    });

    waves.forEach(w => {
      const level = w.author.level?.toString() || 'Unknown';
      waveBreakdown[level] = (waveBreakdown[level] || 0) + 1;
    });

    res.json({
      totalSurges: surges.length,
      surgeBreakdown: Object.entries(surgeBreakdown).map(([level, count]) => ({ level, count, percentage: surges.length > 0 ? (count / surges.length) * 100 : 0 })),
      totalComments: comments.length,
      commentBreakdown: Object.entries(commentBreakdown).map(([level, count]) => ({ level, count, percentage: comments.length > 0 ? (count / comments.length) * 100 : 0 })),
      totalWaves: waves.length,
      waveBreakdown: Object.entries(waveBreakdown).map(([level, count]) => ({ level, count, percentage: waves.length > 0 ? (count / waves.length) * 100 : 0 }))
    });

  } catch (error) {
    logger.error('Error fetching ping level analytics', { error });
    next(error);
  }
};
