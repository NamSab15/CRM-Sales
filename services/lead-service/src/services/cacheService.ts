import Redis from 'ioredis';
import crypto from 'crypto';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
export const redisClient = new Redis(redisUrl);

export const getCacheKey = (queryParams: any): string => {
  const sortedParams = Object.keys(queryParams)
    .sort()
    .reduce((acc, key) => {
      acc[key] = queryParams[key];
      return acc;
    }, {} as any);
  
  const hash = crypto.createHash('sha256').update(JSON.stringify(sortedParams)).digest('hex');
  return `leads:list:${hash}`;
};

export const getCache = async (key: string): Promise<any | null> => {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('[cache]: Failed to get cache', error);
    return null;
  }
};

export const setCache = async (key: string, data: any, ttlSeconds = 60): Promise<void> => {
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    console.error('[cache]: Failed to set cache', error);
  }
};

export const invalidateCache = async (): Promise<void> => {
  try {
    const keys = await redisClient.keys('leads:list:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`[cache]: Invalidated ${keys.length} cache keys`);
    }
  } catch (error) {
    console.error('[cache]: Failed to invalidate cache', error);
  }
};
export default redisClient;
