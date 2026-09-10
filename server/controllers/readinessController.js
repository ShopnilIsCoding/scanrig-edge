import ReadinessCheckin from '../models/ReadinessCheckin.js';
import { normaliseReadinessInput, scoreReadiness } from '../services/readinessService.js';

function safeDateKey(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
}

export async function getTodayReadiness(req, res) {
  try {
    const dateKey = safeDateKey(req.query.dateKey);
    const checkin = await ReadinessCheckin.findOne({ user: req.userId, dateKey }).lean();
    return res.json({ dateKey, checkin });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load readiness check-in' });
  }
}

export async function saveTodayReadiness(req, res) {
  try {
    const dateKey = safeDateKey(req.body.dateKey);
    const input = normaliseReadinessInput(req.body);
    const scored = scoreReadiness(input);
    const checkin = await ReadinessCheckin.findOneAndUpdate(
      { user: req.userId, dateKey },
      { ...input, score: scored.score, band: scored.band },
      { upsert: true, new: true, runValidators: true },
    );
    return res.json({ checkin, assessment: scored });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'Could not save readiness check-in' });
  }
}

export async function getReadinessHistory(req, res) {
  try {
    const days = Math.max(1, Math.min(60, Number(req.query.days || 14)));
    const checkins = await ReadinessCheckin.find({ user: req.userId }).sort({ dateKey: -1 }).limit(days).lean();
    return res.json({ checkins });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load readiness history' });
  }
}
