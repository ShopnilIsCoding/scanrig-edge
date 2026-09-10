import ExerciseDefinition from '../models/ExerciseDefinition.js';
import WorkoutSession from '../models/WorkoutSession.js';
import ReadinessCheckin from '../models/ReadinessCheckin.js';
import { CORE_EXERCISES } from '../config/coreExercises.js';
import { scoreReadiness } from './readinessService.js';
import { estimatePlannedCalories } from './calorieService.js';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ageFromProfile(profile = {}) {
  if (Number(profile.age) > 0) return Number(profile.age);
  if (!profile.dateOfBirth) return null;
  const birth = new Date(profile.dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function recentStats(sessions = []) {
  const recent = sessions.slice(0, 8);
  const forms = recent.map((item) => Number(item.formScore || 0)).filter((x) => x > 0);
  const fatigue = recent.map((item) => Number(item.fatigueScore || 0)).filter((x) => x > 0);
  const quality = recent.map((item) => Number(item.repQualityAverage || 0)).filter((x) => x > 0);
  return {
    sessions: recent.length,
    averageForm: forms.length ? Math.round(forms.reduce((a, b) => a + b, 0) / forms.length) : 0,
    averageRepQuality: quality.length ? Math.round(quality.reduce((a, b) => a + b, 0) / quality.length) : 0,
    averageFatigue: fatigue.length ? Math.round(fatigue.reduce((a, b) => a + b, 0) / fatigue.length) : 0,
    averageMinutes: recent.length ? Math.round(recent.reduce((a, b) => a + Number(b.durationSeconds || 0), 0) / recent.length / 60) : 0,
  };
}

function baseVolume(profile, stats) {
  const level = String(profile.level || 'Beginner').toLowerCase();
  let multiplier = level === 'advanced' ? 1.12 : level === 'intermediate' ? 1 : 0.82;
  if (stats.sessions >= 3 && stats.averageForm >= 92) multiplier += 0.08;
  if (stats.averageForm > 0 && stats.averageForm < 78) multiplier -= 0.1;
  if (stats.averageFatigue >= 65) multiplier -= 0.08;
  const age = ageFromProfile(profile);
  if (age != null && (age < 16 || age >= 60)) multiplier -= 0.08;
  return Math.max(0.68, Math.min(1.25, multiplier));
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => item && !seen.has(item.id) && seen.add(item.id));
}

function equipmentAllowed(exercise, profile = {}) {
  const needed = String(exercise.equipment || '').toLowerCase();
  const available = (profile.equipment || []).join(' ').toLowerCase();
  if (!needed || /no equipment/.test(needed)) return true;
  if (/mat/.test(needed)) return /mat/.test(available) || /no equipment/.test(available);
  if (/dumbbell|barbell|weight|bottle/.test(needed)) return /dumbbell|barbell|weight|bottle/.test(available);
  return true;
}

function goalRank(exercise, goalText) {
  const goal = String(goalText || '').toLowerCase();
  const category = String(exercise.category || '').toLowerCase();
  const id = String(exercise.id || '').toLowerCase();
  if (goal.includes('strength')) return /upper|lower/.test(category) || /curl|press|squat|lunge|push/.test(id) ? 0 : 1;
  if (goal.includes('endurance') || goal.includes('weight')) return /cardio/.test(category) || /jumping|knees/.test(id) ? 0 : 1;
  if (goal.includes('core')) return /core/.test(category) ? 0 : 1;
  return 0;
}

function focusTemplates(dayCount) {
  if (dayCount <= 2) return ['Full body A', 'Full body B'];
  if (dayCount === 3) return ['Full body', 'Lower + cardio', 'Upper + core'];
  if (dayCount === 4) return ['Upper body', 'Lower body', 'Cardio + core', 'Full body'];
  return ['Upper body', 'Lower body', 'Cardio', 'Core', 'Full body'];
}

function focusMatch(exercise, focus) {
  const category = String(exercise.category || '').toLowerCase();
  const text = String(focus || '').toLowerCase();
  if (text.includes('full body')) return true;
  const wantsUpper = text.includes('upper');
  const wantsLower = text.includes('lower');
  const wantsCardio = text.includes('cardio');
  const wantsCore = text.includes('core');
  return (wantsUpper && category.includes('upper'))
    || (wantsLower && category.includes('lower'))
    || (wantsCardio && category.includes('cardio'))
    || (wantsCore && category.includes('core'));
}

function pickExercises(catalog, profile, focus, dayIndex, count) {
  const eligible = catalog.filter((item) => equipmentAllowed(item, profile));
  const focusPool = eligible.filter((item) => focusMatch(item, focus));
  const preferred = (focusPool.length >= Math.min(2, count) ? focusPool : eligible)
    .slice()
    .sort((a, b) => goalRank(a, profile.goal) - goalRank(b, profile.goal));
  const fallback = eligible.slice().sort((a, b) => goalRank(a, profile.goal) - goalRank(b, profile.goal));
  const pool = uniqueById([...preferred, ...fallback]);
  if (!pool.length) return CORE_EXERCISES.slice(0, count);
  const offset = (dayIndex * 2) % pool.length;
  return uniqueById([...pool.slice(offset), ...pool.slice(0, offset)]).slice(0, count);
}

function prescription(exercise, multiplier, sessionLength, restBonusSeconds = 0, profile = {}) {
  const baseTarget = Number(exercise.baseTarget || 10);
  let target = Math.max(4, Math.round(baseTarget * multiplier));
  let sets = Number(exercise.sets || 3);
  if (sessionLength <= 20) sets = Math.min(2, sets);
  if (sessionLength >= 40 && multiplier >= 1) sets = Math.min(4, sets + 1);
  if (exercise.trackingMode === 'hold') target = Math.max(15, Math.round(baseTarget * multiplier));
  const dose = {
    id: exercise.id,
    name: exercise.name,
    sets,
    target,
    unit: exercise.trackingMode === 'hold' ? 'sec' : 'reps',
    trackingMode: exercise.trackingMode || 'reps',
    trackerTemplate: exercise.trackerTemplate || exercise.id,
    status: exercise.status || 'published',
    isCustom: Boolean(exercise.isCustom),
    restSeconds: Math.max(15, Math.min(60, 20 + Number(restBonusSeconds || 0))),
  };
  return { ...dose, estimatedCalories: estimatePlannedCalories(exercise, dose, profile) };
}

function simpleHash(value) {
  let hash = 2166136261;
  const text = JSON.stringify(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function buildUserPlan(user, options = {}) {
  const profile = user.profile || {};
  const sessions = await WorkoutSession.find({ user: user._id }).sort({ createdAt: -1 }).limit(20).lean();
  const custom = await ExerciseDefinition.find({ status: 'published' }).lean();
  const catalog = [
    ...CORE_EXERCISES.map((item) => ({ ...item, isCustom: false, status: 'published' })),
    ...custom.map((item) => ({ ...item, isCustom: true })),
  ];
  const stats = recentStats(sessions);
  const historyMultiplier = baseVolume(profile, stats);
  const days = Array.isArray(profile.days) && profile.days.length ? DAY_ORDER.filter((day) => profile.days.includes(day)) : ['Monday', 'Wednesday', 'Friday'];
  const sessionLength = Math.max(15, Math.min(60, Number(profile.sessionLength || 30)));
  const exerciseCount = sessionLength <= 20 ? 3 : sessionLength <= 35 ? 4 : 5;
  const focuses = focusTemplates(days.length);
  const dateKey = String(options.dateKey || new Date().toISOString().slice(0, 10));
  const todayName = DAY_ORDER.includes(options.todayName) ? options.todayName : null;
  const readinessDoc = await ReadinessCheckin.findOne({ user: user._id, dateKey }).lean();
  const readiness = readinessDoc ? scoreReadiness(readinessDoc) : null;

  const schedule = days.map((day, dayIndex) => {
    const focus = focuses[dayIndex % focuses.length];
    const isToday = todayName === day;
    const readinessMultiplier = isToday && readiness ? readiness.adjustments.volumeMultiplier : 1;
    const effectiveMultiplier = Math.max(0.62, Math.min(1.3, historyMultiplier * readinessMultiplier));
    const chosen = pickExercises(catalog, profile, focus, dayIndex, exerciseCount);
    const restBonus = isToday && readiness ? readiness.adjustments.restBonusSeconds : 0;
    const prescribed = chosen.map((exercise) => prescription(exercise, effectiveMultiplier, sessionLength, restBonus, profile));
    return {
      day,
      sessionLength,
      focus,
      intensity: isToday && readiness ? readiness.adjustments.sessionMode : 'planned',
      volumeMultiplier: Number(effectiveMultiplier.toFixed(2)),
      restBonusSeconds: restBonus,
      calorieTarget: prescribed.reduce((sum, item) => sum + Number(item.estimatedCalories || 0), 0),
      exercises: prescribed,
    };
  });

  const height = Number(profile.height || 0);
  const weight = Number(profile.weight || 0);
  const bmi = height > 0 && weight > 0 ? weight / ((height / 100) ** 2) : null;
  const reasonParts = [
    `${days.length} selected training day${days.length === 1 ? '' : 's'}`,
    `${profile.level || 'Beginner'} starting level`,
    `${sessionLength}-minute sessions`,
  ];
  if (stats.averageForm) reasonParts.push(`${stats.averageForm}% recent average form`);
  if (readiness) reasonParts.push(`${readiness.score}/100 today score`);

  const weeklyCalorieTarget = schedule.reduce((sum, item) => sum + Number(item.calorieTarget || 0), 0);
  const todayCalorieTarget = schedule.find((item) => item.day === todayName)?.calorieTarget || 0;

  const planCore = {
    source: 'scanrig-adaptive-planner-v3',
    caloriePlan: {
      todayTarget: Math.round(todayCalorieTarget),
      weeklyTarget: Math.round(weeklyCalorieTarget),
      note: 'Estimated from exercise type, planned volume, body weight, and training goal.',
    },
    profile: {
      age: ageFromProfile(profile),
      gender: profile.gender || 'male',
      height: height || null,
      weight: weight || null,
      bmi: bmi ? Number(bmi.toFixed(1)) : null,
      goal: profile.goal || 'General fitness',
      level: profile.level || 'Beginner',
      selectedDays: days,
      sessionLength,
      equipment: profile.equipment || [],
    },
    recentPerformance: stats,
    volumeMultiplier: Number(historyMultiplier.toFixed(2)),
    readiness: readiness ? {
      dateKey,
      score: readiness.score,
      band: readiness.band,
      message: readiness.message,
      adjustments: readiness.adjustments,
      energy: readiness.energy,
      sleep: readiness.sleep,
      soreness: readiness.soreness,
      stress: readiness.stress,
      discomfort: readiness.discomfort,
    } : null,
    rationale: `Built from ${reasonParts.join(', ')}.`,
    schedule,
  };
  const planVersion = simpleHash(planCore);
  return { generatedAt: new Date().toISOString(), planVersion, ...planCore };
}
