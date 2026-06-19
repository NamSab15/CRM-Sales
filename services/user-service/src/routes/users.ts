import { Router } from 'express';
import { getUserById, updateUser, listUsers, updateUserSchema } from '../controllers/userController';
import { validate } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', listUsers);
router.get('/:id', getUserById);
router.put('/:id', validate(updateUserSchema), updateUser);

export default router;
