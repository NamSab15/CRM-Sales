import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma';
import { generateToken } from '../utils/jwt';
import { UserRole } from '@crm/shared-types';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.nativeEnum(UserRole),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const register = async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as any,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
      teamId: user.teamId,
    });

    const { password: _, ...userWithoutPassword } = user;

    return res.status(201).json({ token, user: userWithoutPassword });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
      teamId: user.teamId,
    });

    const { password: _, ...userWithoutPassword } = user;

    return res.json({ token, user: userWithoutPassword });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
