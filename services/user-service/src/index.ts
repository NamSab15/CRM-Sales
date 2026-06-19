import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import teamRoutes from './routes/teams';

dotenv.config();

const app = express();
const port = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/teams', teamRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'user-service' });
});

app.listen(port, () => {
  console.log(`[server]: User Service is running at http://localhost:${port}`);
});