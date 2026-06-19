import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { getCache, setCache, getCacheKey } from '../services/cacheService';

// GET /analytics/overview
export const getOverview = async (req: Request, res: Response) => {
  const cacheKey = getCacheKey('overview');
  
  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // 1. Total Leads (excluding DELETED)
    const totalLeads = await prisma.lead.count({
      where: { status: { not: 'DELETED' as any } },
    });

    // 2. New Leads This Month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newLeadsThisMonth = await prisma.lead.count({
      where: {
        createdAt: { gte: startOfMonth },
        status: { not: 'DELETED' as any },
      },
    });

    // 3. Won & Lost Deals (won status is based on associated Lead status)
    const wonDeals = await prisma.deal.count({
      where: { lead: { status: 'WON' as any } },
    });

    const lostDeals = await prisma.deal.count({
      where: { lead: { status: 'LOST' as any } },
    });

    // 4. Conversion Rate (percentage of total leads that are WON)
    const wonLeads = await prisma.lead.count({
      where: { status: 'WON' as any },
    });
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    // 5. Total Revenue (sum of deals where lead is WON)
    const revenueAgg = await prisma.deal.aggregate({
      _sum: { value: true },
      where: { lead: { status: 'WON' as any } },
    });
    const totalRevenue = revenueAgg._sum.value ? Number(revenueAgg._sum.value) : 0;

    // 6. Average Deal Value
    const dealAvg = await prisma.deal.aggregate({
      _avg: { value: true },
    });
    const avgDealValue = dealAvg._avg.value ? Number(dealAvg._avg.value) : 0;

    // 7. Average Sales Cycle Days (time from creation to status set to WON)
    const wonLeadsList = await prisma.lead.findMany({
      where: { status: 'WON' as any },
      select: { createdAt: true, updatedAt: true },
    });
    const totalSalesCycleMs = wonLeadsList.reduce(
      (acc, l) => acc + (l.updatedAt.getTime() - l.createdAt.getTime()),
      0
    );
    const avgSalesCycleDays =
      wonLeadsList.length > 0 ? totalSalesCycleMs / (1000 * 60 * 60 * 24) / wonLeadsList.length : 0;

    const data = {
      totalLeads,
      newLeadsThisMonth,
      wonDeals,
      lostDeals,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      avgDealValue: parseFloat(avgDealValue.toFixed(2)),
      avgSalesCycleDays: parseFloat(avgSalesCycleDays.toFixed(2)),
    };

    await setCache(cacheKey, data);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /analytics/pipeline
export const getPipelineStats = async (req: Request, res: Response) => {
  const cacheKey = getCacheKey('pipeline');

  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // Fetch all pipeline stages to map names
    const stages = await prisma.pipelineStage.findMany({
      orderBy: { order: 'asc' },
    });

    // Group deals by stage
    const dealsGrouped = await prisma.deal.groupBy({
      by: ['currentStageId'],
      _count: { _all: true },
      _sum: { value: true },
    });

    // Fetch deal timestamps and histories to compute average days in current stage
    const deals = await prisma.deal.findMany({
      select: {
        currentStageId: true,
        createdAt: true,
        stageHistories: {
          orderBy: { changedAt: 'desc' },
          take: 1,
          select: { changedAt: true },
        },
      },
    });

    // Calculate in-stage durations
    const stageDurations: Record<string, { totalDays: number; count: number }> = {};
    const now = Date.now();

    deals.forEach((d) => {
      const enterTime = d.stageHistories[0]?.changedAt.getTime() || d.createdAt.getTime();
      const days = (now - enterTime) / (1000 * 60 * 60 * 24);

      if (!stageDurations[d.currentStageId]) {
        stageDurations[d.currentStageId] = { totalDays: 0, count: 0 };
      }
      stageDurations[d.currentStageId].totalDays += days;
      stageDurations[d.currentStageId].count += 1;
    });

    // Build stage stats
    const groupedMap = new Map(dealsGrouped.map((g) => [g.currentStageId, g]));
    const data = stages.map((stage) => {
      const group = groupedMap.get(stage.id);
      const duration = stageDurations[stage.id];
      const avgDays = duration && duration.count > 0 ? duration.totalDays / duration.count : 0;

      return {
        stageId: stage.id,
        stageName: stage.name,
        dealCount: group?._count._all || 0,
        totalValue: group?._sum.value ? Number(group._sum.value) : 0,
        avgDaysInStage: parseFloat(avgDays.toFixed(2)),
      };
    });

    await setCache(cacheKey, data);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /analytics/team
export const getTeamStats = async (req: Request, res: Response) => {
  const { teamId } = req.query;
  const cacheKey = getCacheKey('team', { teamId });

  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // Fetch team members
    const users = await prisma.user.findMany({
      where: teamId ? { teamId: teamId as string } : undefined,
      select: { id: true, name: true },
    });

    // Aggregations using groupBys
    const leadsGrouped = await prisma.lead.groupBy({
      by: ['assignedToId'],
      _count: { _all: true },
      where: { status: { not: 'DELETED' as any } },
    });

    const followupsGrouped = await prisma.followUp.groupBy({
      by: ['assignedToId'],
      _count: { _all: true },
      where: { status: 'DONE' as any },
    });

    const callsGrouped = await prisma.callLog.groupBy({
      by: ['userId'],
      _count: { _all: true },
    });

    // Fetch deals won per user (deal owner = lead assignee)
    const wonDeals = await prisma.deal.findMany({
      where: { lead: { status: 'WON' as any } },
      select: {
        value: true,
        lead: { select: { assignedToId: true } },
      },
    });

    // Construct rep metrics maps
    const leadsMap = new Map(leadsGrouped.map((g) => [g.assignedToId, g._count._all]));
    const followupsMap = new Map(followupsGrouped.map((g) => [g.assignedToId, g._count._all]));
    const callsMap = new Map(callsGrouped.map((g) => [g.userId, g._count._all]));

    const repDealsWon: Record<string, { count: number; revenue: number }> = {};
    wonDeals.forEach((d) => {
      const repId = d.lead.assignedToId;
      if (!repDealsWon[repId]) {
        repDealsWon[repId] = { count: 0, revenue: 0 };
      }
      repDealsWon[repId].count += 1;
      repDealsWon[repId].revenue += Number(d.value);
    });

    const data = users.map((user) => {
      const dealsInfo = repDealsWon[user.id] || { count: 0, revenue: 0 };
      return {
        userId: user.id,
        name: user.name,
        leadsAssigned: leadsMap.get(user.id) || 0,
        followupsDone: followupsMap.get(user.id) || 0,
        callsMade: callsMap.get(user.id) || 0,
        dealsWon: dealsInfo.count,
        revenue: parseFloat(dealsInfo.revenue.toFixed(2)),
      };
    });

    await setCache(cacheKey, data);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /analytics/leads/sources
export const getLeadSources = async (req: Request, res: Response) => {
  const cacheKey = getCacheKey('leads_sources');

  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // Group leads by source (excluding DELETED)
    const sourceGrouped = await prisma.lead.groupBy({
      by: ['source'],
      _count: { _all: true },
      _avg: { score: true },
      where: { status: { not: 'DELETED' as any } },
    });

    // Group won leads by source
    const wonGrouped = await prisma.lead.groupBy({
      by: ['source'],
      _count: { _all: true },
      where: { status: 'WON' as any },
    });

    const wonMap = new Map(wonGrouped.map((g) => [g.source, g._count._all]));

    const data = sourceGrouped.map((g) => {
      const total = g._count._all;
      const won = wonMap.get(g.source) || 0;
      const rate = total > 0 ? (won / total) * 100 : 0;

      return {
        source: g.source,
        count: total,
        conversionRate: parseFloat(rate.toFixed(2)),
        avgScore: g._avg.score ? parseFloat(g._avg.score.toFixed(2)) : 0,
      };
    });

    await setCache(cacheKey, data);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /analytics/leads/scores
export const getLeadScores = async (req: Request, res: Response) => {
  const cacheKey = getCacheKey('leads_scores');

  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // Fetch counts in ranges
    const r1 = await prisma.lead.count({
      where: { score: { gte: 0, lte: 20 }, status: { not: 'DELETED' as any } },
    });
    const r2 = await prisma.lead.count({
      where: { score: { gte: 21, lte: 40 }, status: { not: 'DELETED' as any } },
    });
    const r3 = await prisma.lead.count({
      where: { score: { gte: 41, lte: 60 }, status: { not: 'DELETED' as any } },
    });
    const r4 = await prisma.lead.count({
      where: { score: { gte: 61, lte: 80 }, status: { not: 'DELETED' as any } },
    });
    const r5 = await prisma.lead.count({
      where: { score: { gte: 81, lte: 100 }, status: { not: 'DELETED' as any } },
    });

    const data = [
      { range: '0-20', count: r1 },
      { range: '21-40', count: r2 },
      { range: '41-60', count: r3 },
      { range: '61-80', count: r4 },
      { range: '81-100', count: r5 },
    ];

    await setCache(cacheKey, data);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /analytics/campaigns
export const getCampaignsStats = async (req: Request, res: Response) => {
  const cacheKey = getCacheKey('campaigns');

  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // Fetch all campaigns
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Group actual EmailLog sends per campaign
    const logsGrouped = await prisma.emailLog.groupBy({
      by: ['campaignId'],
      _count: { _all: true },
    });

    const logMap = new Map(logsGrouped.map((g) => [g.campaignId, g._count._all]));

    const data = campaigns.map((c) => ({
      campaignId: c.id,
      name: c.name,
      sentCount: logMap.get(c.id) || c.recipientCount || 0,
      openRate: 0, // Placeholder
      bounceRate: 0, // Placeholder
      status: c.status,
    }));

    await setCache(cacheKey, data);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /analytics/activity
export const getActivityStats = async (req: Request, res: Response) => {
  const { userId, dateFrom, dateTo } = req.query;
  const cacheKey = getCacheKey('activity', { userId, dateFrom, dateTo });

  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // Time window filters
    const leadDateFilter: any = { status: { not: 'DELETED' as any } };
    const dateRangeFilter: any = {};
    if (dateFrom || dateTo) {
      dateRangeFilter.gte = dateFrom ? new Date(dateFrom as string) : undefined;
      dateRangeFilter.lte = dateTo ? new Date(dateTo as string) : undefined;
      leadDateFilter.createdAt = dateRangeFilter;
    }

    if (userId) {
      leadDateFilter.assignedToId = userId as string;
    }

    // 1. Fetch Leads Created
    const leads = await prisma.lead.findMany({
      where: leadDateFilter,
      select: { createdAt: true },
    });

    // 2. Fetch Followups completed
    const followupFilter: any = {
      status: 'DONE' as any,
      completedAt: dateFrom || dateTo ? dateRangeFilter : { not: null },
    };
    if (userId) {
      followupFilter.assignedToId = userId as string;
    }
    const followups = await prisma.followUp.findMany({
      where: followupFilter,
      select: { completedAt: true },
    });

    // 3. Fetch CallLogs made
    const callFilter: any = {};
    if (dateFrom || dateTo) {
      callFilter.calledAt = dateRangeFilter;
    }
    if (userId) {
      callFilter.userId = userId as string;
    }
    const calls = await prisma.callLog.findMany({
      where: callFilter,
      select: { calledAt: true },
    });

    // 4. Fetch EmailLogs sent (Campaign emails)
    const emailFilter: any = {};
    if (dateFrom || dateTo) {
      emailFilter.sentAt = dateRangeFilter;
    }
    // We cannot filter emails directly by rep userId as Campaign has no creator ID relation in DB schema
    const emails = await prisma.emailLog.findMany({
      where: emailFilter,
      select: { sentAt: true },
    });

    // Combine into daily logs in-memory
    const dailyData: Record<
      string,
      { leadsCreated: number; followupsDone: number; callsMade: number; emailsSent: number }
    > = {};

    const addActivity = (date: Date, type: 'leadsCreated' | 'followupsDone' | 'callsMade' | 'emailsSent') => {
      const dateStr = date.toISOString().split('T')[0];
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { leadsCreated: 0, followupsDone: 0, callsMade: 0, emailsSent: 0 };
      }
      dailyData[dateStr][type] += 1;
    };

    leads.forEach((l) => addActivity(l.createdAt, 'leadsCreated'));
    followups.forEach((f) => f.completedAt && addActivity(f.completedAt, 'followupsDone'));
    calls.forEach((c) => addActivity(c.calledAt, 'callsMade'));
    emails.forEach((e) => addActivity(e.sentAt, 'emailsSent'));

    // Convert to sorted array
    const sortedDates = Object.keys(dailyData).sort();
    const data = sortedDates.map((dateStr) => ({
      date: dateStr,
      ...dailyData[dateStr],
    }));

    await setCache(cacheKey, data);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
