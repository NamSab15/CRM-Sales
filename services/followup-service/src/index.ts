import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { prisma } from './prisma';
import { redisClient } from './redis';
import followupRoutes from './routes/followups';
import { FollowUpStatus } from '@crm/shared-types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/followups', followupRoutes);
app.use('/', followupRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'followup-service' });
});

// Cron Job: runs every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('[cron]: Running followup reminder check...');
  try {
    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

    const pendingReminders = await prisma.followUp.findMany({
      where: {
        status: FollowUpStatus.PENDING as any,
        scheduledAt: {
          lte: fifteenMinutesFromNow,
        },
        reminderSentAt: null,
      },
      include: {
        lead: {
          select: { name: true },
        },
      },
    });

    if (pendingReminders.length > 0) {
      console.log(`[cron]: Found ${pendingReminders.length} followups to remind`);
      
      await Promise.all(
        pendingReminders.map(async (followup) => {
          await redisClient.publish('followup:reminder', JSON.stringify({
            ...followup,
            leadName: followup.lead.name,
          }));

          await prisma.followUp.update({
            where: { id: followup.id },
            data: {
              reminderSentAt: now,
            },
          });
        })
      );
    }
  } catch (error) {
    console.error('[cron]: Error during reminder check', error);
  }
});

app.listen(port, () => {
  console.log(`[server]: Follow-up Service is running at http://localhost:${port}`);
});