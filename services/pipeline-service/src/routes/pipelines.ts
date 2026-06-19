import { Router } from 'express';
import {
  createPipeline,
  listPipelines,
  getPipelineById,
  updatePipeline,
  createStage,
  updateStage,
  deleteStage,
  createDeal,
  getDealById,
  moveDealStage,
  updateDeal,
  closeDeal,
  createPipelineSchema,
  updatePipelineSchema,
  createStageSchema,
  updateStageSchema,
  createDealSchema,
  moveDealStageSchema,
  updateDealSchema,
  closeDealSchema
} from '../controllers/pipelineController';
import { validate } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Pipelines
router.post('/pipelines', validate(createPipelineSchema), createPipeline);
router.get('/pipelines', listPipelines);
router.get('/pipelines/:id', getPipelineById);
router.put('/pipelines/:id', validate(updatePipelineSchema), updatePipeline);
router.post('/pipelines/:id/stages', validate(createStageSchema), createStage);
router.put('/pipelines/:id/stages/:stageId', validate(updateStageSchema), updateStage);
router.delete('/pipelines/:id/stages/:stageId', deleteStage);

// Deals
router.post('/deals', validate(createDealSchema), createDeal);
router.get('/deals/:id', getDealById);
router.put('/deals/:id/stage', validate(moveDealStageSchema), moveDealStage);
router.put('/deals/:id', validate(updateDealSchema), updateDeal);
router.post('/deals/:id/close', validate(closeDealSchema), closeDeal);

export default router;
