import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import analyticsRoutes from './routes/analytics';

dotenv.config();

const app = express();
const port = process.env.PORT || 3008; // Set default port matching docker-compose / gateway (3008)

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/analytics', analyticsRoutes);
app.use('/', analyticsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'analytics-service' });
});

app.listen(port, () => {
  console.log(`[server]: Analytics Service is running at http://localhost:${port}`);
});