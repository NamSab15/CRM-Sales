import { Router } from 'express';
import { listNotifications, markAsRead, readAllNotifications } from '../controllers/notificationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', listNotifications);
router.put('/read-all', readAllNotifications);
router.put('/:id/read', markAsRead);

export default router;
