// Calorie values are estimates, not medical measurements. We use a MET-style
// calculation scaled by body weight and the time ScanRig actually observes the
// exercise. This makes one user's estimate differ from another's without
// pretending a webcam can directly measure energy expenditure.
export const EXERCISE_MET = {
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

export const REP_SECONDS = {
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

export function kcalForSeconds({ exercise, seconds = 0, weightKg = 68, intensity = 1 }) {
  const weight = Math.max(35, Math.min(220, Number(weightKg || 68)));
  const met = exerciseMet(exercise) * Math.max(.75, Math.min(1.3, Number(intensity || 1)));
  const minutes = Math.max(0, Number(seconds || 0)) / 60;
  return Math.max(0, (met * 3.5 * weight / 200) * minutes);
}

export function plannedExerciseSeconds(exercise = {}, dose = {}) {
  const sets = Math.max(1, Number(dose.sets || exercise.sets || 3));
  const target = Math.max(1, Number(dose.target || exercise.baseTarget || 10));
  if ((dose.trackingMode || exercise.trackingMode) === 'hold' || (dose.unit || '').includes('sec')) return sets * target;
  const secPerRep = Number(exercise.secondsPerRep || REP_SECONDS[exercise.id] || 2.6);
  return sets * target * secPerRep;
}

export function goalCalorieMultiplier(goal = '') {
  const text = String(goal || '').toLowerCase();
  if (text.includes('weight')) return 1.12;
  if (text.includes('endurance')) return 1.08;
  if (text.includes('strength')) return 1.0;
  return .96;
}

export function estimatePlannedExerciseCalories(exercise = {}, dose = {}, profile = {}) {
  return kcalForSeconds({
    exercise,
    seconds: plannedExerciseSeconds(exercise, dose),
    weightKg: profile.weight || 68,
    intensity: goalCalorieMultiplier(profile.goal),
  });
}

export function estimatePlanCalories(session, catalog = [], profile = {}) {
  if (!session?.exercises?.length) return 0;
  return Math.round(session.exercises.reduce((sum, dose) => {
    const exercise = catalog.find((item) => item.id === dose.id) || dose;
    return sum + estimatePlannedExerciseCalories(exercise, dose, profile);
  }, 0));
}

export function caloriesFromExerciseSeconds(secondsByExercise = {}, catalog = [], profile = {}) {
  return Object.entries(secondsByExercise || {}).reduce((sum, [id, seconds]) => {
    const exercise = catalog.find((item) => item.id === id) || { id };
    return sum + kcalForSeconds({ exercise, seconds, weightKg: profile.weight || 68 });
  }, 0);
}

export function sameLocalDay(value, date = new Date()) {
  const d = new Date(value || 0);
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - mondayOffset);
  return d;
}
