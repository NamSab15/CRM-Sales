import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pipelineRoutes from './routes/pipelines';

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/pipeline', pipelineRoutes);
app.use('/', pipelineRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'pipeline-service' });
});

app.listen(port, () => {
  console.log(`[server]: Pipeline Service is running at http://localhost:${port}`);
});