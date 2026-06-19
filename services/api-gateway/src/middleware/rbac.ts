import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@crm/shared-types';

export const rbacMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { role } = req.user;
  const method = req.method;
  const cleanPath = req.path.replace(/\/$/, '');

  // 1. DELETE /api/leads/* -> ADMIN only
  if (method === 'DELETE' && req.path.startsWith('/api/leads')) {
    if (role !== UserRole.ADMIN) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    return next();
  }

  // 2. POST /api/leads/assign -> ADMIN, SALES_MANAGER only
  if (method === 'POST' && cleanPath === '/api/leads/assign') {
    if (role !== UserRole.ADMIN && role !== UserRole.SALES_MANAGER) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    return next();
  }

  // 3. GET /api/analytics/* -> ADMIN, SALES_MANAGER only
  if (method === 'GET' && req.path.startsWith('/api/analytics')) {
    if (role !== UserRole.ADMIN && role !== UserRole.SALES_MANAGER) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    return next();
  }

  // All other /api/* -> permitted for all authenticated roles
  next();
};
