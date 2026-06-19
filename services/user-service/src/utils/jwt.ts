import jwt from 'jsonwebtoken';
import { UserRole } from '@crm/shared-types';

const JWT_SECRET = process.env.JWT_SECRET || 'crm-super-secret-key';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  teamId?: string | null;
}

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};
