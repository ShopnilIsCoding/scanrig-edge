import User from '../models/User.js';
import WorkoutSession from '../models/WorkoutSession.js';
import { buildUserPlan } from '../services/personalizationService.js';
import { answerTrainerQuestion } from '../services/geminiTrainer.js';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function compactSession(session) {
  if (!session) return null;
  return {
    date: session.createdAt,
    reps: Number(session.reps || 0),
    formScore: Number(session.formScore || 0),
    repQualityAverage: Number(session.repQualityAverage || 0),
    fatigueScore: Number(session.fatigueScore || 0),
    readinessScore: Number(session.readinessScore || 0),
    durationMinutes: Math.round(Number(session.durationSeconds || 0) / 60),
    caloriesBurned: Math.round(Number(session.caloriesBurned || 0)),
    calorieTarget: Math.round(Number(session.calorieTarget || 0)),
    exerciseCalories: session.exerciseCalories || {},
    exercises: session.exercises || [],
    formReport: session.formReport ? {
      grade: session.formReport.grade,
      consistency: session.formReport.consistency,
      focus: session.formReport.focus,
      focusTip: session.formReport.focusTip,
      strongest: session.formReport.strongest,
    } : null,
  };
}

async function buildTrainerContext(user) {
  const now = new Date();
  const dateKey = now.toISOString().slice(0,10);
  const todayName = DAY_NAMES[now.getDay()];
  const [plan, sessions] = await Promise.all([
    buildUserPlan(user, { dateKey, todayName }),
    WorkoutSession.find({ user: user._id }).sort({ createdAt: -1 }).limit(8).lean(),
  ]);
  const todaySession = plan.schedule?.find((item) => item.day === todayName) || null;
  const totalXp = sessions.reduce((sum, item) => sum + Number(item.xp || 0), 0);
  const totalReps = sessions.reduce((sum, item) => sum + Number(item.reps || 0), 0);
  return {
    userName: user.name,
    coachName: user.profile?.gender === 'female' ? 'Jody' : 'James',
    profile: {
      age: plan.profile?.age || null,
      heightCm: plan.profile?.height || null,
      weightKg: plan.profile?.weight || null,
      goal: plan.profile?.goal,
      level: plan.profile?.level,
      selectedDays: plan.profile?.selectedDays || [],
      sessionLengthMinutes: plan.profile?.sessionLength,
      equipment: plan.profile?.equipment || [],
    },
    readiness: plan.readiness,
    caloriePlan: plan.caloriePlan || null,
    todayName,
    todaySession,
    weeklySchedule: plan.schedule?.map((item) => ({ day: item.day, focus: item.focus, sessionLength: item.sessionLength, exercises: item.exercises })) || [],
    recentPerformance: plan.recentPerformance,
    latestWorkout: compactSession(sessions[0]),
    recentWorkouts: sessions.slice(0,4).map(compactSession),
    recordedTotals: { workouts: sessions.length, reps: totalReps, calories: Math.round(sessions.reduce((sum,item)=>sum+Number(item.caloriesBurned||0),0)), xpInRecentHistory: totalXp },
  };
}

export async function getTrainerContext(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ context: await buildTrainerContext(user), geminiEnabled: Boolean(process.env.GEMINI_API_KEY) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not prepare your trainer' });
  }
}

export async function chatWithTrainer(req, res) {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ message: 'Ask your trainer a question first' });
    if (message.length > 1200) return res.status(400).json({ message: 'Please keep the question shorter' });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const context = await buildTrainerContext(user);
    const result = await answerTrainerQuestion({ message, history: req.body.history, context });
    return res.json({ ...result, context });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Your trainer could not reply right now' });
  }
}
