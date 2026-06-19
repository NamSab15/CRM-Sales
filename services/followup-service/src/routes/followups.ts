import { Router } from 'express';
import {
  createFollowup,
  listFollowups,
  getFollowupById,
  updateFollowup,
  completeFollowup,
  missFollowup,
  createFollowupSchema,
  updateFollowupSchema
} from '../controllers/followupController';
import { validate } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createFollowupSchema), createFollowup);
router.get('/', listFollowups);
router.get('/:id', getFollowupById);
router.put('/:id', validate(updateFollowupSchema), updateFollowup);
router.put('/:id/complete', completeFollowup);
router.put('/:id/miss', missFollowup);

export default router;
