import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { UserRole } from '@crm/shared-types';

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
});

export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email } = req.body;

  try {
    if (req.user?.userId !== id && req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json(updatedUser);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const listUsers = async (req: Request, res: Response) => {
  if (req.user?.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: 'Forbidden: Admin access only' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  try {
    const users = await prisma.user.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = await prisma.user.count();

    return res.json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
