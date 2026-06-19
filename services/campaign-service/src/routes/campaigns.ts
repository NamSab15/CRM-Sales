import { Router } from 'express';
import {
  createTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  createCampaign,
  listCampaigns,
  getCampaignById,
  deleteCampaign,
  createTemplateSchema,
  updateTemplateSchema,
  createCampaignSchema,
} from '../controllers/campaignController';
import { validate } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Secure all endpoints with authMiddleware
router.use(authMiddleware);

// Templates
router.post('/templates', validate(createTemplateSchema), createTemplate);
router.get('/templates', listTemplates);
router.put('/templates/:id', validate(updateTemplateSchema), updateTemplate);
router.delete('/templates/:id', deleteTemplate);

// Campaigns
router.post('/campaigns', validate(createCampaignSchema), createCampaign);
router.get('/campaigns', listCampaigns);
router.get('/campaigns/:id', getCampaignById);
router.delete('/campaigns/:id', deleteCampaign);

export default router;
