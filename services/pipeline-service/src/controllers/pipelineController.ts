import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { redisClient } from '../redis';
import { LeadStatus } from '@crm/shared-types';

// Zod Schemas
export const createPipelineSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  stages: z.array(z.object({
    name: z.string().min(1, 'Stage name is required'),
    order: z.number().int(),
    color: z.string().min(3, 'Color is required'),
  })).min(1, 'Pipeline must have at least one stage'),
});

export const updatePipelineSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const createStageSchema = z.object({
  name: z.string().min(1, 'Stage name is required'),
  order: z.number().int(),
  color: z.string().min(3, 'Color is required'),
});

export const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
  color: z.string().min(3).optional(),
});

export const createDealSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  pipelineId: z.string().uuid('Invalid pipeline ID'),
  currentStageId: z.string().uuid('Invalid stage ID'),
  value: z.number().positive('Value must be a positive number'),
  probability: z.number().min(0).max(100, 'Probability must be between 0 and 100'),
  expectedCloseDate: z.string().datetime().optional(),
});

export const moveDealStageSchema = z.object({
  stageId: z.string().uuid('Invalid stage ID'),
  note: z.string().optional(),
});

export const updateDealSchema = z.object({
  value: z.number().positive().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional(),
});

export const closeDealSchema = z.object({
  outcome: z.enum(['WON', 'LOST']),
  reason: z.string().optional(),
});

// PIPELINES

// POST /pipelines
export const createPipeline = async (req: Request, res: Response) => {
  const { name, stages } = req.body;

  try {
    const pipeline = await prisma.$transaction(async (tx) => {
      const p = await tx.pipeline.create({
        data: {
          name,
          createdBy: req.user?.userId || '',
        },
      });

      await Promise.all(
        stages.map((stage: any) =>
          tx.pipelineStage.create({
            data: {
              name: stage.name,
              order: stage.order,
              color: stage.color,
              pipelineId: p.id,
            },
          })
        )
      );

      return tx.pipeline.findUnique({
        where: { id: p.id },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
    });

    return res.status(201).json(pipeline);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /pipelines
export const listPipelines = async (req: Request, res: Response) => {
  try {
    const pipelines = await prisma.pipeline.findMany({
      include: {
        stages: { orderBy: { order: 'asc' } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(pipelines);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /pipelines/:id
export const getPipelineById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            deals: {
              select: {
                id: true,
                leadId: true,
                value: true,
                probability: true,
                lead: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    const formattedStages = pipeline.stages.map((stage) => {
      const deals = stage.deals.map((deal) => ({
        id: deal.id,
        leadId: deal.leadId,
        value: deal.value,
        probability: deal.probability,
        leadName: deal.lead.name,
      }));
      return {
        id: stage.id,
        name: stage.name,
        order: stage.order,
        color: stage.color,
        deals,
      };
    });

    return res.json({
      id: pipeline.id,
      name: pipeline.name,
      stages: formattedStages,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// PUT /pipelines/:id
export const updatePipeline = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const updated = await prisma.pipeline.update({
      where: { id },
      data: { name },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// POST /pipelines/:id/stages
export const createStage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, order, color } = req.body;

  try {
    const pipeline = await prisma.pipeline.findUnique({ where: { id } });
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    const newStage = await prisma.pipelineStage.create({
      data: {
        name,
        order,
        color,
        pipelineId: id,
      },
    });

    return res.status(201).json(newStage);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// PUT /pipelines/:id/stages/:stageId
export const updateStage = async (req: Request, res: Response) => {
  const { stageId } = req.params;

  try {
    const updated = await prisma.pipelineStage.update({
      where: { id: stageId },
      data: req.body,
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// DELETE /pipelines/:id/stages/:stageId
export const deleteStage = async (req: Request, res: Response) => {
  const { stageId } = req.params;

  try {
    const dealCount = await prisma.deal.count({
      where: { currentStageId: stageId },
    });

    if (dealCount > 0) {
      return res.status(400).json({ error: 'Cannot delete stage: active deals exist in it' });
    }

    await prisma.pipelineStage.delete({
      where: { id: stageId },
    });

    return res.json({ message: 'Stage deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// DEALS

// POST /deals
export const createDeal = async (req: Request, res: Response) => {
  const { leadId, pipelineId, currentStageId, value, probability, expectedCloseDate } = req.body;

  try {
    const deal = await prisma.deal.create({
      data: {
        leadId,
        pipelineId,
        currentStageId,
        value,
        probability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      },
    });

    return res.status(201).json(deal);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /deals/:id
export const getDealById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        lead: {
          select: { name: true, company: true, email: true },
        },
        currentStage: true,
        stageHistories: {
          orderBy: { changedAt: 'desc' },
          include: {
            fromStage: true,
            toStage: true,
            changer: { select: { name: true } },
          },
        },
      },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    return res.json(deal);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// PUT /deals/:id/stage
export const moveDealStage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { stageId, note } = req.body;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { currentStage: true },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const targetStage = await prisma.pipelineStage.findUnique({
      where: { id: stageId },
    });

    if (!targetStage) {
      return res.status(404).json({ error: 'Target stage not found' });
    }

    const updatedDeal = await prisma.$transaction(async (tx) => {
      // Create stage history
      await tx.dealStageHistory.create({
        data: {
          dealId: id,
          fromStageId: deal.currentStageId,
          toStageId: stageId,
          changedBy: req.user?.userId || '',
        },
      });

      // Update current stage
      return tx.deal.update({
        where: { id },
        data: { currentStageId: stageId },
        include: { currentStage: true },
      });
    });

    // Publish Redis Event
    await redisClient.publish(
      'deal:stage_changed',
      JSON.stringify({
        dealId: id,
        fromStage: deal.currentStage.name,
        toStage: updatedDeal.currentStage.name,
        changedBy: req.user?.userId || 'system',
        note,
      })
    );

    return res.json(updatedDeal);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// PUT /deals/:id
export const updateDeal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { value, probability, expectedCloseDate } = req.body;

  try {
    const updated = await prisma.deal.update({
      where: { id },
      data: {
        value,
        probability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// POST /deals/:id/close
export const closeDeal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { outcome } = req.body; // 'WON' | 'LOST'

  try {
    const deal = await prisma.deal.findUnique({ where: { id } });
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const leadStatus = outcome === 'WON' ? LeadStatus.WON : LeadStatus.LOST;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update deal probability to 100/0 depending on outcome
      const probability = outcome === 'WON' ? 100 : 0;
      const d = await tx.deal.update({
        where: { id },
        data: {
          probability,
        },
      });

      // 2. Update parent lead status
      await tx.lead.update({
        where: { id: deal.leadId },
        data: {
          status: leadStatus as any,
        },
      });

      return d;
    });

    return res.json({ message: `Deal closed successfully as ${outcome}`, deal: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
