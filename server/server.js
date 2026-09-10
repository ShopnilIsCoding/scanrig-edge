import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { connectDatabase } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import workoutRoutes from './routes/workoutRoutes.js';
import aiSampleRoutes from './routes/aiSampleRoutes.js';
import { ensureAdminAccount } from './config/ensureAdmin.js';
import aiTrainingRoutes from './routes/aiTrainingRoutes.js';
import { getModelDirectory, getModelStatus } from './services/aiTrainingService.js';
import exerciseRoutes from './routes/exerciseRoutes.js';
import personalizationRoutes from './routes/personalizationRoutes.js';
import readinessRoutes from './routes/readinessRoutes.js';
import trainerRoutes from './routes/trainerRoutes.js';

const app = express();

const allowedOrigins = String(process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/ai-model/status', async (_req, res) => {
  try {
    return res.json(await getModelStatus());
  } catch (error) {
    return res.status(500).json({ installed: false, message: error.message });
  }
});
app.use('/ai-model', express.static(getModelDirectory(), {
  fallthrough: true,
  maxAge: 0,
  etag: true,
  setHeaders(res) {
    // The model is progressively retrained. Never let a browser keep a stale
    // model/manifest after the admin publishes a new training run.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  },
}));
app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/ai-samples', aiSampleRoutes);
app.use('/api/ai-training', aiTrainingRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/personalization', personalizationRoutes);
app.use('/api/readiness', readinessRoutes);
app.use('/api/trainer', trainerRoutes);

const port = Number(process.env.PORT || 5000);

if (!process.env.MONGODB_URI) {
  console.error('[ScanRig API] MONGODB_URI is required');
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[ScanRig API] JWT_SECRET must be set to a strong value of at least 32 characters');
  process.exit(1);
}

connectDatabase()
  .then(async () => {
    await ensureAdminAccount();
    app.listen(port, '0.0.0.0', () => console.log(`[ScanRig API] listening on port ${port}`));
  })
  .catch((error) => {
    console.error('[ScanRig API] database startup failed:', error.message);
    process.exit(1);
  });
