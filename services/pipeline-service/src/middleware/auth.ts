import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@crm/shared-types';

const JWT_SECRET = process.env.JWT_SECRET || 'crm-super-secret-key';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  teamId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication token missing or invalid' });
  }
};
