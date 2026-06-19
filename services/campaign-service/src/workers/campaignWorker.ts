import { Worker, Job } from 'bullmq';
import { prisma } from '../prisma';
import { redisClient } from '../redis';
import { emailService } from '../services/emailService';

// Parse Redis Connection details to avoid direct client sharing conflicts in BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
let connection: any;
try {
  const url = new URL(redisUrl);
  connection = {
    host: url.hostname || 'redis',
    port: parseInt(url.port) || 6379,
  };
  if (url.password) {
    connection.password = url.password;
  }
} catch (err) {
  const parts = redisUrl.replace('redis://', '').split(':');
  connection = {
    host: parts[0] || 'redis',
    port: parseInt(parts[1]) || 6379,
  };
}

export const initCampaignWorker = () => {
  const worker = new Worker(
    'campaign_send',
    async (job: Job) => {
      const { campaignId, leads, createdBy } = job.data;
      console.log(`[CampaignWorker]: Processing campaign job ${job.id} for campaign ${campaignId} with ${leads?.length || 0} leads`);

      try {
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { template: true },
        });

        if (!campaign) {
          console.error(`[CampaignWorker]: Campaign ${campaignId} not found in database.`);
          return;
        }

        if (!leads || leads.length === 0) {
          console.log(`[CampaignWorker]: No leads to process for campaign ${campaignId}`);
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'SENT' as any },
          });
          return;
        }

        // Personalize and send email to each recipient lead
        for (const lead of leads) {
          try {
            const personalizedBody = emailService.substituteVariables(campaign.template.content, lead);
            await emailService.sendMail(lead.email, campaign.template.subject, personalizedBody);

            // Log send in EmailLog table
            await prisma.emailLog.create({
              data: {
                campaignId,
                recipient: lead.email,
              },
            });
          } catch (sendErr) {
            console.error(`[CampaignWorker]: Failed to send or log email to ${lead.email}`, sendErr);
          }
        }

        // Update campaign status to SENT
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'SENT' as any },
        });

        // Publish Redis event for notification-service to pick up and alert user
        await redisClient.publish(
          'campaign:sent',
          JSON.stringify({
            campaignId,
            name: campaign.name,
            recipientCount: leads.length,
            createdBy: createdBy || 'system',
          })
        );
        
        console.log(`[CampaignWorker]: Successfully completed campaign ${campaignId}`);
      } catch (error) {
        console.error(`[CampaignWorker]: Error processing campaign ${campaignId}`, error);
        throw error;
      }
    },
    { connection }
  );

  worker.on('completed', (job) => {
    console.log(`[CampaignWorker]: Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[CampaignWorker]: Job ${job?.id} failed with error`, err);
  });

  console.log('[CampaignWorker]: Campaign send worker initialized.');
  return worker;
};
