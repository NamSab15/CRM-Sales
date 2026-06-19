import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const url = new URL(redisUrl);

export const aiScoreQueue = new Queue('ai_score', {
  connection: {
    host: url.hostname || 'redis',
    port: parseInt(url.port) || 6379,
    maxRetriesPerRequest: null,
  },
});

export const addScoringJob = async (leadId: string): Promise<any> => {
  return aiScoreQueue.add('scoreLead', { leadId });
};
