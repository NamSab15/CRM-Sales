import { Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { prisma } from '../prisma';
import { redisClient, getCacheKey, getCache, setCache, invalidateCache } from '../services/cacheService';
import { addScoringJob } from '../queues/aiQueue';
import { LeadSource, LeadStatus } from '@crm/shared-types';

export const createLeadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  company: z.string().min(2, 'Company must be at least 2 characters'),
  phone: z.string().min(5, 'Phone is too short'),
  email: z.string().email('Invalid email address'),
  source: z.nativeEnum(LeadSource),
});

export const updateLeadSchema = z.object({
  name: z.string().min(2).optional(),
  company: z.string().min(2).optional(),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional(),
  source: z.nativeEnum(LeadSource).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  score: z.number().min(0).max(100).optional(),
});

export const assignLeadSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

// POST /leads
export const createLead = async (req: Request, res: Response) => {
  const { name, company, phone, email, source } = req.body;

  try {
    const lead = await prisma.lead.create({
      data: {
        name,
        company,
        phone,
        email,
        source: source as any,
        status: LeadStatus.NEW as any,
        assignedToId: req.user?.userId || '',
      },
    });

    await invalidateCache();

    // Publish event to Redis
    await redisClient.publish('lead:created', JSON.stringify(lead));

    return res.status(201).json(lead);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /leads
export const listLeads = async (req: Request, res: Response) => {
  const cacheKey = getCacheKey(req.query);

  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const { status, source, assignedTo, scoreMin, scoreMax } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      status: status ? (status as any) : { not: LeadStatus.DELETED as any },
    };

    if (source) whereClause.source = source as any;
    if (assignedTo) whereClause.assignedToId = assignedTo as string;
    
    if (scoreMin || scoreMax) {
      whereClause.score = {};
      if (scoreMin) whereClause.score.gte = parseInt(scoreMin as string);
      if (scoreMax) whereClause.score.lte = parseInt(scoreMax as string);
    }

    const leads = await prisma.lead.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        aiScore: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = await prisma.lead.count({ where: whereClause });

    const responseData = {
      leads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await setCache(cacheKey, responseData, 60);

    return res.json(responseData);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /leads/:id
export const getLeadById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        aiScore: true,
        followups: { orderBy: { scheduledAt: 'desc' } },
        callLogs: { orderBy: { calledAt: 'desc' } },
        deals: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!lead || lead.status === (LeadStatus.DELETED as any)) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    return res.json(lead);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// PUT /leads/:id
export const updateLead = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: req.body,
    });

    await invalidateCache();

    await redisClient.publish('lead:updated', JSON.stringify({ id, ...req.body }));

    return res.json(updatedLead);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// DELETE /leads/:id
export const deleteLead = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deletedLead = await prisma.lead.update({
      where: { id },
      data: {
        status: LeadStatus.DELETED as any,
      },
    });

    await invalidateCache();

    return res.json({ message: 'Lead soft-deleted successfully', lead: deletedLead });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// POST /leads/:id/assign
export const assignLead = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const userUrl = process.env.USER_SERVICE_URL || 'http://user-service:3005';
    try {
      await axios.get(`${userUrl}/users/${userId}`, {
        headers: {
          Authorization: req.headers.authorization || '',
        },
      });
    } catch (err) {
      return res.status(400).json({ error: 'User does not exist or user-service unreachable' });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        assignedToId: userId,
      },
    });

    await invalidateCache();

    await redisClient.publish(
      'lead:assigned',
      JSON.stringify({
        leadId: id,
        assignedTo: userId,
        assignedBy: req.user?.userId || 'system',
      })
    );

    return res.json({ message: 'Lead assigned successfully', lead });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// POST /leads/:id/score
export const scoreLead = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await addScoringJob(id);

    return res.status(202).json({ message: 'AI scoring job accepted' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /leads/:id/timeline
export const getLeadTimeline = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // 1. Deals Stage Histories
    const deals = await prisma.deal.findMany({
      where: { leadId: id },
      select: { id: true },
    });
    const dealIds = deals.map((d) => d.id);
    const dealHistories = await prisma.dealStageHistory.findMany({
      where: { dealId: { in: dealIds } },
      include: {
        fromStage: true,
        toStage: true,
        changer: { select: { name: true } },
      },
    });

    // 2. Follow-ups
    const followups = await prisma.followUp.findMany({
      where: { leadId: id },
    });

    // 3. CallLogs
    const callLogs = await prisma.callLog.findMany({
      where: { leadId: id },
      include: {
        user: { select: { name: true } },
      },
    });

    // 4. EmailLogs
    const emailLogs = await prisma.emailLog.findMany({
      where: { recipient: lead.email },
      include: {
        campaign: true,
      },
    });

    // 5. AuditLogs
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: id },
    });

    const timeline: any[] = [];

    dealHistories.forEach((dh) => {
      timeline.push({
        id: dh.id,
        type: 'deal_stage_history',
        timestamp: dh.changedAt,
        message: `Deal stage changed from ${dh.fromStage.name} to ${dh.toStage.name} by ${dh.changer.name}`,
        details: dh,
      });
    });

    followups.forEach((f) => {
      timeline.push({
        id: f.id,
        type: 'followup',
        timestamp: f.createdAt,
        message: `Follow-up of type ${f.type} was ${f.status.toLowerCase()} (scheduled: ${f.scheduledAt.toISOString()})`,
        details: f,
      });
    });

    callLogs.forEach((c) => {
      timeline.push({
        id: c.id,
        type: 'call_log',
        timestamp: c.calledAt,
        message: `Call logged by ${c.user.name} (duration: ${c.duration}s)`,
        details: c,
      });
    });

    emailLogs.forEach((e) => {
      timeline.push({
        id: e.id,
        type: 'email_log',
        timestamp: e.sentAt,
        message: `Email sent via campaign ${e.campaign.name} to ${e.recipient}`,
        details: e,
      });
    });

    auditLogs.forEach((a) => {
      timeline.push({
        id: a.id,
        type: 'audit_log',
        timestamp: a.createdAt,
        message: `Audit log: ${a.action} performed on ${a.entity} by ${a.performedBy}`,
        details: a,
      });
    });

    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json(timeline);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
