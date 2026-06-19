import { Router } from 'express';
import {
  getOverview,
  getPipelineStats,
  getTeamStats,
  getLeadSources,
  getLeadScores,
  getCampaignsStats,
  getActivityStats,
} from '../controllers/analyticsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication middleware
router.use(authMiddleware);

// Enforce role permission: double-check req.user.role is ADMIN or SALES_MANAGER
router.use((req, res, next) => {
  const role = req.user?.role;
  if (role !== 'ADMIN' && role !== 'SALES_MANAGER') {
    return res.status(403).json({ error: 'Forbidden: ADMIN or SALES_MANAGER role required' });
  }
  next();
});

// Map REST endpoints
router.get('/overview', getOverview);
router.get('/pipeline', getPipelineStats);
router.get('/team', getTeamStats);
router.get('/leads/sources', getLeadSources);
router.get('/leads/scores', getLeadScores);
router.get('/campaigns', getCampaignsStats);
router.get('/activity', getActivityStats);

export default router;
