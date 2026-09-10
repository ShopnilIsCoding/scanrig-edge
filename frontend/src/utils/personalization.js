export const BASE_PROFILE = {
  name: '',
  gender: 'male',
  dateOfBirth: '',
  age: null,
  height: 172,
  weight: 68,
  goal: '',
  level: '',
  days: [],
  sessionLength: 30,
  equipment: ['No equipment', 'Exercise mat'],
  onboardingComplete: false,
};

export function profileIsComplete(profile = {}) {
  return Boolean(
    profile.onboardingComplete
    && profile.dateOfBirth
    && Number(profile.height) >= 100
    && Number(profile.weight) >= 30
    && profile.goal
    && profile.level
    && Array.isArray(profile.days)
    && profile.days.length >= 2
  );
}

export function deriveProgress(history = []) {
  const sessions = Array.isArray(history) ? history : [];
  const completedSessions = sessions.length;
  const points = sessions.reduce((sum, item) => sum + Number(item.xp || 0), 0);
  const totalReps = sessions.reduce((sum, item) => sum + Number(item.reps || 0), 0);
  const activeSeconds = sessions.reduce((sum, item) => sum + Number(item.durationSeconds || 0), 0);
  const totalCalories = sessions.reduce((sum, item) => sum + Number(item.caloriesBurned || 0), 0);
  const formValues = sessions.map((item) => Number(item.formScore || 0)).filter((value) => value > 0);
  const averageForm = formValues.length ? Math.round(formValues.reduce((a, b) => a + b, 0) / formValues.length) : 0;
  const bestForm = formValues.length ? Math.max(...formValues) : 0;
  const fatigueValues = sessions.map((item) => Number(item.fatigueScore || 0)).filter((value) => value > 0);
  const readinessValues = sessions.map((item) => Number(item.readinessScore || 0)).filter((value) => value > 0);
  const averageFatigue = fatigueValues.length ? Math.round(fatigueValues.reduce((a, b) => a + b, 0) / fatigueValues.length) : 0;
  const averageReadiness = readinessValues.length ? Math.round(readinessValues.reduce((a, b) => a + b, 0) / readinessValues.length) : 0;

  const now = new Date();
  const weekStart = new Date(now);
  const day = (now.getDay() + 6) % 7;
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - day);
  const weeklyItems = sessions.filter((item) => new Date(item.completedAt || item.createdAt || 0) >= weekStart);
  const weeklySessions = weeklyItems.length;
  const weeklyCalories = weeklyItems.reduce((sum, item) => sum + Number(item.caloriesBurned || 0), 0);

  return { points, completedSessions, totalReps, activeSeconds, totalCalories: Math.round(totalCalories), weeklyCalories: Math.round(weeklyCalories), averageForm, bestForm, averageFatigue, averageReadiness, weeklySessions };
}

export function getRecommendedExerciseIds(profile = {}, history = []) {
  const goal = String(profile.goal || '').toLowerCase();
  const hasWeights = (profile.equipment || []).some((item) => /dumbbell|weight|bottle/i.test(item));

  // Demo-friendly movements stay easy to frame in a laptop webcam.
  if (goal.includes('strength')) {
    return hasWeights
      ? ['biceps-curl', 'shoulder-press', 'squat', 'high-knees']
      : ['squat', 'biceps-curl', 'shoulder-press', 'high-knees'];
  }
  if (goal.includes('endurance') || goal.includes('weight')) {
    return ['jumping-jack', 'high-knees', 'squat', 'biceps-curl'];
  }
  return ['jumping-jack', 'high-knees', 'biceps-curl', 'squat'];
}

export function getAdaptiveTarget(baseTarget, profile = {}, history = []) {
  const progress = deriveProgress(history);
  const level = String(profile.level || 'Beginner').toLowerCase();
  let multiplier = level === 'advanced' ? 1.2 : level === 'intermediate' ? 1.08 : 0.85;
  if (progress.averageForm >= 93 && progress.completedSessions >= 2) multiplier += 0.08;
  if (progress.averageForm > 0 && progress.averageForm < 75) multiplier -= 0.08;
  return Math.max(6, Math.round(baseTarget * multiplier));
}

export function buildPersonalizedInsight(profile = {}, history = []) {
  const progress = deriveProgress(history);
  const height = Number(profile.height || 0);
  const weight = Number(profile.weight || 0);
  const bmi = height > 0 && weight > 0 ? weight / ((height / 100) ** 2) : null;
  const goal = profile.goal || 'general fitness';
  const level = profile.level || 'Beginner';

  if (!progress.completedSessions) {
    return {
      headline: 'Your first plan is ready',
      text: `Start with short, camera-friendly movements for ${goal.toLowerCase()}. Your ${level.toLowerCase()} plan will adapt after we collect a few form scores.`,
      bmi: bmi ? bmi.toFixed(1) : null,
    };
  }

  const quality = progress.averageForm >= 90
    ? 'Your movement quality is strong, so the next session can increase volume a little.'
    : progress.averageForm >= 80
      ? 'Your form is consistent. Keep the same pace and focus on cleaner end positions.'
      : 'Keep the next session controlled and use the live cues before increasing reps.';

  return {
    headline: `${progress.averageForm || '--'}% average form`,
    text: quality,
    bmi: bmi ? bmi.toFixed(1) : null,
  };
}
