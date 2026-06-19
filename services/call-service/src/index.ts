import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8006;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'call-service' });
});

app.get('/api/v1/call', (req, res) => {
  res.json({
    message: 'Welcome to SalesFlow CRM Call API',
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`[server]: call-service is running at http://localhost:${port}`);
});