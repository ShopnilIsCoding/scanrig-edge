import WorkoutSession from '../models/WorkoutSession.js';

function calculateXp({ reps = 0, formScore = 0, exercises = [] }) {
  return Math.max(50, Math.round(Number(reps) * 2 + Number(formScore) + (Array.isArray(exercises) ? exercises.length : 0) * 15));
}

function clamp(value, min, max, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}


function cleanText(value, max = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sanitizeFormReport(value) {
  if (!value || typeof value !== 'object') return null;
  const cleanHighlight = (item) => item && typeof item === 'object' ? {
    id: cleanText(item.id, 80),
    name: cleanText(item.name, 100),
    average: clamp(item.average, 0, 100),
  } : undefined;
  const breakdown = Array.isArray(value.exerciseBreakdown) ? value.exerciseBreakdown.slice(0, 20).map((item) => ({
    id: cleanText(item?.id, 80),
    name: cleanText(item?.name, 100),
    reps: Math.max(0, Math.round(Number(item?.reps || 0))),
    average: clamp(item?.average, 0, 100),
    best: clamp(item?.best, 0, 100),
    adjust: Math.max(0, Math.round(Number(item?.adjust || 0))),
    topCue: cleanText(item?.topCue, 220),
  })) : [];
  return {
    grade: cleanText(value.grade, 8),
    consistency: clamp(value.consistency, 0, 100),
    strongReps: Math.max(0, Math.round(Number(value.strongReps || 0))),
    goodReps: Math.max(0, Math.round(Number(value.goodReps || 0))),
    adjustReps: Math.max(0, Math.round(Number(value.adjustReps || 0))),
    strongest: cleanHighlight(value.strongest),
    focus: cleanHighlight(value.focus),
    focusTip: cleanText(value.focusTip, 320),
    fatigueMessage: cleanText(value.fatigueMessage, 320),
    fatigueEvents: Math.max(0, Math.round(Number(value.fatigueEvents || 0))),
    coachSummary: cleanText(value.coachSummary, 520),
    exerciseBreakdown: breakdown,
  };
}

export async function createWorkout(req, res) {
  try {
    const reps = Math.max(0, Number(req.body.reps || 0));
    const formScore = clamp(req.body.formScore, 0, 100);
    const repQualityAverage = clamp(req.body.repQualityAverage, 0, 100);
    const fatigueScore = clamp(req.body.fatigueScore, 0, 100);
    const fatigueEvents = Math.max(0, Math.round(Number(req.body.fatigueEvents || 0)));
    const readinessScore = clamp(req.body.readinessScore, 0, 100);
    const readinessBand = ['ready', 'moderate', 'recovery'].includes(req.body.readinessBand) ? req.body.readinessBand : '';
    const planVersion = String(req.body.planVersion || '').slice(0, 64);
    const durationSeconds = Math.max(0, Number(req.body.durationSeconds || 0));
    const caloriesBurned = clamp(req.body.caloriesBurned, 0, 5000);
    const calorieTarget = clamp(req.body.calorieTarget, 0, 5000);
    const exerciseCalories = req.body.exerciseCalories && typeof req.body.exerciseCalories === 'object'
      ? Object.fromEntries(Object.entries(req.body.exerciseCalories).slice(0, 30).map(([key,value]) => [String(key).slice(0,80), clamp(value,0,2000)]))
      : {};
    const exercises = Array.isArray(req.body.exercises) ? req.body.exercises.slice(0, 20) : [];
    const formReport = sanitizeFormReport(req.body.formReport);
    const xp = calculateXp({ reps, formScore, exercises });
    const session = await WorkoutSession.create({
      user: req.userId,
      reps,
      formScore,
      repQualityAverage,
      fatigueScore,
      fatigueEvents,
      readinessScore,
      readinessBand,
      planVersion,
      durationSeconds,
      caloriesBurned,
      calorieTarget,
      exerciseCalories,
      exercises,
      formReport,
      xp,
    });
    return res.status(201).json({ session });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'Could not save workout' });
  }
}

export async function listWorkouts(req, res) {
  const sessions = await WorkoutSession.find({ user: req.userId }).sort({ createdAt: -1 }).limit(100);
  return res.json({ sessions });
}

export async function workoutSummary(req, res) {
  const sessions = await WorkoutSession.find({ user: req.userId }).sort({ createdAt: -1 }).limit(500).lean();
  const totalReps = sessions.reduce((sum, item) => sum + Number(item.reps || 0), 0);
  const totalXp = sessions.reduce((sum, item) => sum + Number(item.xp || 0), 0);
  const activeSeconds = sessions.reduce((sum, item) => sum + Number(item.durationSeconds || 0), 0);
  const totalCalories = sessions.reduce((sum, item) => sum + Number(item.caloriesBurned || 0), 0);
  const scores = sessions.map((item) => Number(item.formScore || 0)).filter((value) => value > 0);
  const fatigue = sessions.map((item) => Number(item.fatigueScore || 0)).filter((value) => value > 0);
  const averageForm = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  const averageFatigue = fatigue.length ? Math.round(fatigue.reduce((sum, value) => sum + value, 0) / fatigue.length) : 0;
  const bestForm = scores.length ? Math.max(...scores) : 0;
  return res.json({
    summary: {
      completedSessions: sessions.length,
      totalReps,
      totalXp,
      activeSeconds,
      totalCalories: Math.round(totalCalories),
      averageForm,
      averageFatigue,
      bestForm,
    },
  });
}
