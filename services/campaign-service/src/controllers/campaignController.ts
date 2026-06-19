import { Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { Queue } from 'bullmq';
import { prisma } from '../prisma';
import { CampaignStatus } from '@crm/shared-types';

// Parse Redis Connection details to avoid direct client sharing conflicts in BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
let connection: any;
try {
  const url = new URL(redisUrl);
  connection = {
    host: url.hostname || 'redis',
    port: parseInt(url.port) || 6379,
  };
  if (url.password) {
    connection.password = url.password;
  }
} catch (err) {
  const parts = redisUrl.replace('redis://', '').split(':');
  connection = {
    host: parts[0] || 'redis',
    port: parseInt(parts[1]) || 6379,
  };
}

// Instantiate BullMQ Queue
const campaignQueue = new Queue('campaign_send', { connection });

// Helper to extract template variables dynamically using {{var}} patterns
const extractVariables = (content: string): string[] => {
  const regex = /\{\{\s*([^}]+)\s*\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.add(match[1].trim());
  }
  return Array.from(matches);
};

// Zod Schemas
export const createTemplateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  subject: z.string().min(1, 'Subject is required'),
  bodyHtml: z.string().min(1, 'Body HTML is required'),
  variables: z.array(z.string()).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(2).optional(),
  subject: z.string().min(1).optional(),
  bodyHtml: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(2, 'Campaign name must be at least 2 characters'),
  templateId: z.string().uuid('Invalid template ID'),
  scheduledAt: z.string().datetime('Invalid scheduled datetime ISO string'),
  filters: z.object({
    source: z.string().optional(),
    status: z.string().optional(),
    scoreMin: z.number().optional(),
  }).optional(),
});

// Template Endpoints
export const createTemplate = async (req: Request, res: Response) => {
  const { name, subject, bodyHtml } = req.body;

  try {
    const template = await prisma.campaignTemplate.create({
      data: {
        name,
        subject,
        content: bodyHtml,
      },
    });

    return res.status(201).json({
      ...template,
      bodyHtml: template.content,
      variables: extractVariables(template.content),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const listTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await prisma.campaignTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const responseTemplates = templates.map((template) => ({
      ...template,
      bodyHtml: template.content,
      variables: extractVariables(template.content),
    }));

    return res.json(responseTemplates);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, subject, bodyHtml } = req.body;

  try {
    const updated = await prisma.campaignTemplate.update({
      where: { id },
      data: {
        name,
        subject,
        content: bodyHtml,
      },
    });

    return res.json({
      ...updated,
      bodyHtml: updated.content,
      variables: extractVariables(updated.content),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.campaignTemplate.delete({
      where: { id },
    });

    return res.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Campaign Endpoints
export const createCampaign = async (req: Request, res: Response) => {
  const { name, templateId, scheduledAt, filters } = req.body;

  try {
    // 1. Verify template exists
    const template = await prisma.campaignTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // 2. Fetch leads from lead-service via HTTP call
    const leadServiceUrl = process.env.LEAD_SERVICE_URL || 'http://lead-service:8001';
    const queryParams = new URLSearchParams();
    queryParams.append('limit', '999999'); // Ensure all matching leads are retrieved
    if (filters?.source) queryParams.append('source', filters.source);
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.scoreMin) queryParams.append('scoreMin', filters.scoreMin.toString());

    let leads: any[] = [];
    try {
      const leadsResponse = await axios.get(`${leadServiceUrl}/leads?${queryParams.toString()}`, {
        headers: {
          Authorization: req.headers.authorization || '',
        },
      });
      leads = leadsResponse.data.leads || [];
    } catch (err: any) {
      console.error('[CampaignController]: Failed to resolve leads from lead-service', err.message);
      return res.status(400).json({ error: 'Failed to resolve recipient list from lead-service' });
    }

    // 3. Create Campaign in DB
    const campaignScheduledTime = new Date(scheduledAt);
    const campaignStatus = campaignScheduledTime.getTime() > Date.now() 
      ? CampaignStatus.SCHEDULED 
      : CampaignStatus.DRAFT;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        subject: template.subject,
        templateId,
        status: campaignStatus as any,
        recipientCount: leads.length,
        scheduledAt: campaignScheduledTime,
      },
    });

    // 4. Schedule BullMQ job if scheduled to run in future, or run immediately if past/now
    const delay = campaignScheduledTime.getTime() - Date.now();
    await campaignQueue.add(
      'send-campaign',
      {
        campaignId: campaign.id,
        leads: leads.map((l) => ({ name: l.name, company: l.company, email: l.email })),
        createdBy: req.user?.userId || 'system',
      },
      {
        delay: Math.max(0, delay),
      }
    );

    return res.status(201).json(campaign);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const listCampaigns = async (req: Request, res: Response) => {
  const { status } = req.query;

  try {
    const whereClause: any = {};
    if (status) {
      whereClause.status = status as any;
    }

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      include: {
        template: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(campaigns);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getCampaignById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        template: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Fetch stats: count of sent emails in EmailLog
    const sentCount = await prisma.emailLog.count({
      where: { campaignId: id },
    });

    return res.json({
      ...campaign,
      stats: {
        sent: sentCount,
        opened: 0, // Placeholder
        bounced: 0, // Placeholder
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteCampaign = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Only allow deletion if campaign is in DRAFT state
    if (campaign.status !== (CampaignStatus.DRAFT as any)) {
      return res.status(400).json({ error: 'Only draft campaigns can be deleted' });
    }

    await prisma.campaign.delete({
      where: { id },
    });

    return res.json({ message: 'Campaign deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
