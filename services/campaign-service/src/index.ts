import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import campaignRoutes from './routes/campaigns';
import { initCampaignWorker } from './workers/campaignWorker';

dotenv.config();

const app = express();
const port = process.env.PORT || 3004; // Use port 3004 matching the docker-compose / gateway configuration

app.use(cors());
app.use(express.json());

// Routes - supports both gateway proxied paths and direct calls
app.use('/api/campaigns', campaignRoutes);
app.use('/', campaignRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'campaign-service' });
});

// Initialize the BullMQ background campaign worker
initCampaignWorker();

app.listen(port, () => {
  console.log(`[server]: Campaign Service is running at http://localhost:${port}`);
});