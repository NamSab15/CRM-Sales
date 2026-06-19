import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { prisma } from './prisma';
import notificationRoutes from './routes/notifications';

dotenv.config();

const app = express();
const port = process.env.PORT || 3007;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/notify', notificationRoutes);
app.use('/', notificationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'notification-service' });
});

const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

// userId -> WebSocket connections mapping
const clients = new Map<string, Set<WebSocket>>();

const JWT_SECRET = process.env.JWT_SECRET || 'crm-super-secret-key';

wss.on('connection', (ws: WebSocket, userId: string) => {
  console.log(`[ws]: User ${userId} connected`);
  
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(ws);

  ws.on('close', () => {
    console.log(`[ws]: User ${userId} disconnected`);
    const userConnections = clients.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        clients.delete(userId);
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[ws]: Socket error for user ${userId}:`, err);
  });
});

// Handle upgrade manually to authenticate via query token
server.on('upgrade', (request, socket, head) => {
  const urlObj = new URL(request.url || '', `http://localhost:${port}`);
  const token = urlObj.searchParams.get('token');

  if (!token) {
    console.log('[ws]: Upgrade request missing token');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const userId = decoded.userId;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, userId);
    });
  } catch (error) {
    console.log('[ws]: Failed to authenticate upgrade request token');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

// Redis Subscription Client
const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const redisSub = new Redis(redisUrl);

redisSub.subscribe('lead:assigned', 'deal:stage_changed', 'followup:reminder', 'campaign:sent');

redisSub.on('message', async (channel, message) => {
  console.log(`[redis]: Received message on channel ${channel}`);
  try {
    const payload = JSON.parse(message);
    let userId = '';
    let type = channel;
    let msgText = '';

    if (channel === 'lead:assigned') {
      const { leadId, assignedTo } = payload;
      userId = assignedTo;
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      msgText = `New lead assigned: ${lead?.name || 'Unknown Lead'}`;
    } 
    else if (channel === 'deal:stage_changed') {
      const { dealId, toStage } = payload;
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: { lead: true }
      });
      if (deal) {
        userId = deal.lead.assignedToId;
        msgText = `Deal moved to ${toStage}`;
      }
    } 
    else if (channel === 'followup:reminder') {
      const { assignedToId, type: fType, leadName } = payload;
      userId = assignedToId;
      msgText = `Follow-up due in 15 min: ${fType} with ${leadName || 'lead'}`;
    } 
    else if (channel === 'campaign:sent') {
      const { name, recipientCount, createdBy } = payload;
      userId = createdBy;
      msgText = `Campaign ${name} sent to ${recipientCount} contacts`;
    }

    if (userId && msgText) {
      // 1. Save Notification in DB
      const dbNotification = await prisma.notification.create({
        data: {
          userId,
          type,
          message: msgText,
        },
      });

      // 2. Push to WebSocket if active
      const userConnections = clients.get(userId);
      if (userConnections && userConnections.size > 0) {
        const payloadStr = JSON.stringify(dbNotification);
        userConnections.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payloadStr);
          }
        });
        console.log(`[ws]: Pushed notification to ${userConnections.size} connection(s) for user ${userId}`);
      }
    }
  } catch (err) {
    console.error(`[redis]: Error handling subscription message on channel ${channel}:`, err);
  }
});

server.listen(port, () => {
  console.log(`[server]: Notification Service is running at http://localhost:${port}`);
});