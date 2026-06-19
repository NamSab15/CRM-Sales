import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

export const createTeamSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters'),
  managerId: z.string().uuid('Invalid manager UUID'),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user UUID'),
});

export const createTeam = async (req: Request, res: Response) => {
  const { name, managerId } = req.body;

  try {
    const manager = await prisma.user.findUnique({ where: { id: managerId } });
    if (!manager) {
      return res.status(404).json({ error: 'Manager user not found' });
    }

    const team = await prisma.team.create({
      data: {
        name,
        managerId,
      },
    });

    await prisma.user.update({
      where: { id: managerId },
      data: { teamId: team.id },
    });

    return res.status(201).json(team);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getTeamById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    return res.json(team);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const addTeamMember = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { teamId: id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
      },
    });

    return res.json({ message: 'User added to team successfully', user: updatedUser });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const removeTeamMember = async (req: Request, res: Response) => {
  const { id, userId } = req.params;

  try {
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.teamId !== id) {
      return res.status(404).json({ error: 'User not found in this team' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { teamId: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
      },
    });

    return res.json({ message: 'User removed from team successfully', user: updatedUser });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const listTeams = async (req: Request, res: Response) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return res.json(teams);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
