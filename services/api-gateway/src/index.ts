import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth';
import { rbacMiddleware } from './middleware/rbac';
import { ipRateLimiter, userRateLimiter } from './middleware/rateLimit';
import proxyRouter, { wsProxy } from './proxy/router';
import { metricsMiddleware, register, activeConnections } from './middleware/metrics';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// Apply Prometheus metrics middleware first to capture all requests
app.use(metricsMiddleware);

// Expose public metrics scraper endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err: any) {
    res.status(500).end(err.message || err);
  }
});

// Request logging using morgan
app.use(morgan('combined'));

app.use(cors());

// Apply global IP rate limiting first
app.use(ipRateLimiter);

// Health check endpoint (exempt from auth and rbac)
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'api-gateway' });
});

// Apply Auth Middleware to all other requests
app.use(authMiddleware);

// Apply User Rate Limiting after auth (so we have user ID)
app.use(userRateLimiter);

// Apply RBAC Middleware to all other requests
app.use(rbacMiddleware);

// Proxy router (which forwards requests to target services)
app.use(proxyRouter);

// Start Server and set up WebSocket proxying
const server = app.listen(port, () => {
  console.log(`[gateway]: API Gateway is running at http://localhost:${port}`);
});

// Monitor active TCP connections
let connectionsCount = 0;
server.on('connection', (socket) => {
  connectionsCount++;
  activeConnections.set(connectionsCount);
  socket.on('close', () => {
    connectionsCount--;
    activeConnections.set(connectionsCount);
  });
});

// Handle WebSocket proxy upgrade
server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/ws')) {
    console.log('[gateway]: Upgrading connection to WebSocket');
    (wsProxy as any).upgrade(request, socket, head);
  } else {
    socket.destroy();
  }
});