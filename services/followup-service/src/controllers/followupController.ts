import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { FollowUpType, FollowUpStatus } from '@crm/shared-types';

export const createFollowupSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  assignedTo: z.string().uuid('Invalid assigned user ID'),
  scheduledAt: z.string().datetime('Invalid ISO date string'),
  type: z.nativeEnum(FollowUpType),
  notes: z.string().min(1, 'Notes cannot be empty'),
});

export const updateFollowupSchema = z.object({
  scheduledAt: z.string().datetime('Invalid ISO date string').optional(),
  notes: z.string().optional(),
  type: z.nativeEnum(FollowUpType).optional(),
});

export const createFollowup = async (req: Request, res: Response) => {
  const { leadId, assignedTo, scheduledAt, type, notes } = req.body;

  try {
    const followup = await prisma.followUp.create({
      data: {
        leadId,
        assignedToId: assignedTo,
        scheduledAt: new Date(scheduledAt),
        type: type as any,
        status: FollowUpStatus.PENDING as any,
        notes,
      },
    });

    return res.status(201).json(followup);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const listFollowups = async (req: Request, res: Response) => {
  const { assignedTo, status, dateFrom, dateTo } = req.query;

  try {
    const whereClause: any = {};

    if (assignedTo) whereClause.assignedToId = assignedTo as string;
    if (status) whereClause.status = status as any;
    
    if (dateFrom || dateTo) {
      whereClause.scheduledAt = {};
      if (dateFrom) whereClause.scheduledAt.gte = new Date(dateFrom as string);
      if (dateTo) whereClause.scheduledAt.lte = new Date(dateTo as string);
    }

    const followups = await prisma.followUp.findMany({
      where: whereClause,
      include: {
        lead: {
          select: { name: true, company: true, email: true },
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    return res.json(followups);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getFollowupById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const followup = await prisma.followUp.findUnique({
      where: { id },
      include: {
        lead: {
          select: { name: true, company: true, email: true },
        },
      },
    });

    if (!followup) {
      return res.status(404).json({ error: 'Followup not found' });
    }

    return res.json(followup);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateFollowup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { scheduledAt, notes, type } = req.body;

  try {
    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        notes,
        type: type as any,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const completeFollowup = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        status: FollowUpStatus.DONE as any,
        completedAt: new Date(),
      },
    });

    return res.json({ message: 'Followup marked as completed', followup: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const missFollowup = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        status: FollowUpStatus.MISSED as any,
      },
    });

    return res.json({ message: 'Followup marked as missed', followup: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
