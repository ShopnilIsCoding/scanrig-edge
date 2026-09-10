import { getTrainingJob, startTrainingJob } from '../services/aiTrainingService.js';

function enabled() {
  return String(process.env.ENABLE_AI_TRAINING || 'false').toLowerCase() === 'true';
}

export async function trainingStatus(_req, res) {
  if (!enabled()) {
    return res.json({ ...getTrainingJob(), enabled: false, message: 'Server-side retraining is disabled in this public demo.' });
  }
  return res.json({ ...getTrainingJob(), enabled: true });
}

export async function startTraining(_req, res) {
  if (!enabled()) {
    return res.status(503).json({ message: 'Server-side retraining is disabled in this public demo.' });
  }
  try {
    return res.status(202).json(await startTrainingJob());
  } catch (error) {
    console.error('[ScanRig AI] training start failed:', error);
    return res.status(500).json({ message: error.message || 'Could not start training' });
  }
}
