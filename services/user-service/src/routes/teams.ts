import { Router } from 'express';
import { createTeam, getTeamById, addTeamMember, removeTeamMember, listTeams, createTeamSchema, addMemberSchema } from '../controllers/teamController';
import { validate } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createTeamSchema), createTeam);
router.get('/', listTeams);
router.get('/:id', getTeamById);
router.post('/:id/members', validate(addMemberSchema), addTeamMember);
router.delete('/:id/members/:userId', removeTeamMember);

export default router;
