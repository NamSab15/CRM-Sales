import { Router } from 'express';
import { 
  createLead, 
  listLeads, 
  getLeadById, 
  updateLead, 
  deleteLead, 
  assignLead, 
  scoreLead, 
  getLeadTimeline,
  createLeadSchema,
  updateLeadSchema,
  assignLeadSchema
} from '../controllers/leadController';
import { validate } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createLeadSchema), createLead);
router.get('/', listLeads);
router.get('/:id', getLeadById);
router.put('/:id', validate(updateLeadSchema), updateLead);
router.delete('/:id', deleteLead);
router.post('/:id/assign', validate(assignLeadSchema), assignLead);
router.post('/:id/score', scoreLead);
router.get('/:id/timeline', getLeadTimeline);

export default router;
