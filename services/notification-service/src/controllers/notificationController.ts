import { Request, Response } from 'express';
import { prisma } from '../prisma';

export const listNotifications = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: [
        { readAt: 'asc' }, // null values (unread) come first
        { createdAt: 'desc' }
      ]
    });

    return res.json(notifications);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  try {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        readAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const readAllNotifications = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return res.json({ message: `Successfully marked all ${result.count} notifications as read` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
