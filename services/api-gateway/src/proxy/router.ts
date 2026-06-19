import { createProxyMiddleware } from 'http-proxy-middleware';
import { Router } from 'express';

const router = Router();

const proxies = [
  { path: '/api/leads', target: process.env.LEAD_SERVICE_URL || 'http://lead-service:3001' },
  { path: '/api/pipeline', target: process.env.PIPELINE_SERVICE_URL || 'http://pipeline-service:3002' },
  { path: '/api/followups', target: process.env.FOLLOWUP_SERVICE_URL || 'http://followup-service:3003' },
  { path: '/api/campaigns', target: process.env.CAMPAIGN_SERVICE_URL || 'http://campaign-service:3004' },
  { path: '/api/users', target: process.env.USER_SERVICE_URL || 'http://user-service:3005' },
  { path: '/api/calls', target: process.env.CALL_SERVICE_URL || 'http://call-service:3006' },
  { path: '/api/notify', target: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3007' },
  { path: '/api/analytics', target: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3008' },
  { path: '/auth', target: process.env.USER_SERVICE_URL || 'http://user-service:3005' },
];

proxies.forEach(({ path, target }) => {
  router.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      logLevel: 'debug',
    })
  );
});

export const wsProxy = createProxyMiddleware({
  target: process.env.NOTIFICATION_WS_URL || 'ws://notification-service:3007',
  ws: true,
  changeOrigin: true,
  logLevel: 'debug',
});

export default router;
