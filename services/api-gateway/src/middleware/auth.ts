import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@crm/shared-types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
        teamId?: string | null;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'crm-super-secret-key';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const cleanPath = req.path.replace(/\/$/, '');
  
  // Skip authentication for auth login/register endpoints
  if (req.method === 'POST' && (cleanPath === '/auth/login' || cleanPath === '/auth/register')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: UserRole;
      teamId?: string | null;
    };

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      teamId: decoded.teamId,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication token missing or invalid' });
  }
};
