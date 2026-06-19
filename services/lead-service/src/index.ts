import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import leadRoutes from './routes/leads';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/leads', leadRoutes);
app.use('/api/leads', leadRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'lead-service' });
});

app.listen(port, () => {
  console.log(`[server]: Lead Service is running at http://localhost:${port}`);
});