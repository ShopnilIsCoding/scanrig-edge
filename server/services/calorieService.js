const EXERCISE_MET = {
  'push-up': 6.0,
  squat: 5.5,
  lunge: 5.5,
  'jumping-jack': 8.0,
  'shoulder-press': 5.0,
  'biceps-curl': 3.5,
  'high-knees': 8.5,
  crunch: 4.0,
  plank: 3.5,
};

const REP_SECONDS = {
  'push-up': 3.2,
  squat: 3.0,
  lunge: 2.8,
  'jumping-jack': 1.4,
  'shoulder-press': 3.0,
  'biceps-curl': 3.0,
  'high-knees': 1.1,
  crunch: 2.8,
};

export function exerciseMet(exercise = {}) {
  return Number(exercise.met || EXERCISE_MET[exercise.id] || 5.0);
}

export function goalCalorieMultiplier(goal = '') {
  const text = String(goal || '').toLowerCase();
  if (text.includes('weight')) return 1.12;
  if (text.includes('endurance')) return 1.08;
  if (text.includes('strength')) return 1.0;
  return .96;
}

export function kcalForSeconds({ exercise, seconds = 0, weightKg = 68, intensity = 1 }) {
  const weight = Math.max(35, Math.min(220, Number(weightKg || 68)));
  const met = exerciseMet(exercise) * Math.max(.75, Math.min(1.3, Number(intensity || 1)));
  return Math.max(0, (met * 3.5 * weight / 200) * (Math.max(0, Number(seconds || 0)) / 60));
}

export function plannedExerciseSeconds(exercise = {}, dose = {}) {
  const sets = Math.max(1, Number(dose.sets || exercise.sets || 3));
  const target = Math.max(1, Number(dose.target || exercise.baseTarget || 10));
  if ((dose.trackingMode || exercise.trackingMode) === 'hold' || (dose.unit || '').includes('sec')) return sets * target;
  return sets * target * Number(exercise.secondsPerRep || REP_SECONDS[exercise.id] || 2.6);
}

export function estimatePlannedCalories(exercise, dose, profile = {}) {
  return Math.round(kcalForSeconds({
    exercise,
    seconds: plannedExerciseSeconds(exercise, dose),
    weightKg: profile.weight || 68,
    intensity: goalCalorieMultiplier(profile.goal),
  }));
}
