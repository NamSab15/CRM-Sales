import rateLimit from 'express-rate-limit';

export const ipRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const userRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 1000,
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown-ip',
  skip: (req) => !req.user, // skip for unauthenticated requests
  message: { error: 'Too many requests for this user account, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
