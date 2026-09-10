import ExerciseDefinition from '../models/ExerciseDefinition.js';
import TrainingSample from '../models/TrainingSample.js';
import { CORE_EXERCISES, CORE_LABELS } from '../config/coreExercises.js';

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function cleanList(value, max = 8) {
  const list = Array.isArray(value) ? value : String(value || '').split(/\n|,/);
  return list.map((item) => String(item).trim()).filter(Boolean).slice(0, max);
}

async function withSampleStats(exercises) {
  const labels = exercises.map((item) => item.id);
  const grouped = labels.length
    ? await TrainingSample.aggregate([
      { $match: { label: { $in: labels }, status: { $ne: 'rejected' } } },
      { $group: { _id: '$label', count: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } } } },
    ])
    : [];
  const stats = Object.fromEntries(grouped.map((item) => [item._id, { count: item.count, approved: item.approved }]));
  return exercises.map((item) => {
    const current = stats[item.id] || { count: 0, approved: 0 };
    const trained = Boolean(item.syntheticAvailable || item.trainedAt);
    return {
      ...item,
      realSampleCount: current.count,
      approvedSampleCount: current.approved,
      aiReady: trained,
      needsRetrain: !item.syntheticAvailable && Boolean(item.trainedAt) && current.approved > Number(item.trainedSampleCount || 0),
    };
  });
}

function serialize(item) {
  const raw = item.toObject ? item.toObject() : item;
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    difficulty: raw.difficulty,
    target: raw.target,
    equipment: raw.equipment,
    duration: raw.duration,
    description: raw.description,
    youtubeUrl: raw.youtubeUrl || '',
    instructions: raw.instructions || [],
    commonMistakes: raw.commonMistakes || [],
    primaryMuscles: raw.primaryMuscles || [],
    secondaryMuscles: raw.secondaryMuscles || [],
    accent: raw.accent || 'cyan',
    icon: raw.icon || '◆',
    trackingMode: raw.trackingMode || 'classifier-only',
    trackerTemplate: raw.trackerTemplate || 'classifier-only',
    baseTarget: Number(raw.baseTarget || 10),
    sets: Number(raw.sets || 3),
    status: raw.status || 'draft',
    sampleGoal: Number(raw.sampleGoal || 25),
    syntheticAvailable: Boolean(raw.syntheticAvailable),
    trainedAt: raw.trainedAt || null,
    trainedSampleCount: Number(raw.trainedSampleCount || 0),
    trainedModelVersion: raw.trainedModelVersion || '',
    publishedAt: raw.publishedAt || null,
    createdAt: raw.createdAt || null,
    isCustom: true,
  };
}

export async function listPublicExercises(_req, res) {
  try {
    const custom = await ExerciseDefinition.find({ status: 'published' }).sort({ name: 1 });
    const serialized = await withSampleStats(custom.map(serialize));
    return res.json({ exercises: serialized });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load published exercises' });
  }
}

export async function listAdminExercises(_req, res) {
  try {
    const custom = await ExerciseDefinition.find().sort({ createdAt: -1 });
    const customWithStats = await withSampleStats(custom.map(serialize));
    const coreWithStats = await withSampleStats(CORE_EXERCISES.map((item) => ({
      ...item,
      description: '',
      instructions: [],
      commonMistakes: [],
      primaryMuscles: [],
      secondaryMuscles: [],
      accent: 'cyan',
      icon: '◆',
      status: 'published',
      sampleGoal: 25,
      syntheticAvailable: true,
      isCustom: false,
    })));
    return res.json({ core: coreWithStats, custom: customWithStats });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load exercise definitions' });
  }
}

export async function createExercise(req, res) {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 3) return res.status(400).json({ message: 'Exercise name is required' });
    const id = slugify(req.body.id || name);
    if (!id || CORE_LABELS.includes(id) || id === 'unknown') return res.status(409).json({ message: 'That exercise identifier is already reserved' });
    if (await ExerciseDefinition.exists({ id })) return res.status(409).json({ message: 'An exercise with that name already exists' });

    const exercise = await ExerciseDefinition.create({
      id,
      name,
      category: String(req.body.category || 'Custom').slice(0, 60),
      difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(req.body.difficulty) ? req.body.difficulty : 'Beginner',
      target: String(req.body.target || '').slice(0, 160),
      equipment: String(req.body.equipment || 'No equipment').slice(0, 120),
      duration: String(req.body.duration || '3 sets × 10 reps').slice(0, 100),
      description: String(req.body.description || '').slice(0, 700),
      youtubeUrl: String(req.body.youtubeUrl || '').trim().slice(0, 500),
      instructions: cleanList(req.body.instructions, 8),
      commonMistakes: cleanList(req.body.commonMistakes, 8),
      primaryMuscles: cleanList(req.body.primaryMuscles, 8),
      secondaryMuscles: cleanList(req.body.secondaryMuscles, 8),
      accent: ['cyan', 'orange', 'lime', 'violet'].includes(req.body.accent) ? req.body.accent : 'cyan',
      icon: String(req.body.icon || '◆').slice(0, 4),
      trackingMode: ['reps', 'hold', 'classifier-only'].includes(req.body.trackingMode) ? req.body.trackingMode : 'classifier-only',
      trackerTemplate: ['classifier-only', ...CORE_LABELS].includes(req.body.trackerTemplate) ? req.body.trackerTemplate : 'classifier-only',
      baseTarget: Number(req.body.baseTarget || 10),
      sets: Number(req.body.sets || 3),
      status: 'draft',
      sampleGoal: Number(req.body.sampleGoal || 25),
      syntheticAvailable: false,
      createdBy: req.userId,
    });
    return res.status(201).json({ exercise: { ...serialize(exercise), realSampleCount: 0, aiReady: false } });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'Could not create exercise' });
  }
}

export async function updateExercise(req, res) {
  try {
    const exercise = await ExerciseDefinition.findOne({ id: req.params.id });
    if (!exercise) return res.status(404).json({ message: 'Custom exercise not found' });

    const allowed = ['name', 'category', 'difficulty', 'target', 'equipment', 'duration', 'description', 'youtubeUrl', 'accent', 'icon', 'trackingMode', 'trackerTemplate', 'baseTarget', 'sets', 'sampleGoal'];
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) exercise[key] = req.body[key];
    });
    ['instructions', 'commonMistakes', 'primaryMuscles', 'secondaryMuscles'].forEach((key) => {
      if (req.body[key] !== undefined) exercise[key] = cleanList(req.body[key], 8);
    });

    if (req.body.status !== undefined) {
      const status = req.body.status;
      if (!['draft', 'beta', 'published'].includes(status)) return res.status(400).json({ message: 'Invalid exercise status' });
      if (status === 'published') {
        const approved = await TrainingSample.countDocuments({ label: exercise.id, status: 'approved' });
        if (approved < 8) {
          return res.status(400).json({ message: `Collect at least 8 approved ${exercise.name} samples before publishing. Current: ${approved}.` });
        }
        if (!exercise.trainedAt) {
          return res.status(400).json({ message: `Retrain ScanRig AI after collecting ${exercise.name} samples before publishing this new class.` });
        }
        exercise.publishedAt = new Date();
      }
      if (status !== 'published') exercise.publishedAt = null;
      exercise.status = status;
    }

    await exercise.save();
    const [withStats] = await withSampleStats([serialize(exercise)]);
    return res.json({ exercise: withStats });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'Could not update exercise' });
  }
}

export async function deleteExercise(req, res) {
  const exercise = await ExerciseDefinition.findOne({ id: req.params.id });
  if (!exercise) return res.status(404).json({ message: 'Custom exercise not found' });
  const sampleCount = await TrainingSample.countDocuments({ label: exercise.id });
  if (sampleCount > 0) return res.status(409).json({ message: 'Delete or relabel this exercise’s training samples before deleting the exercise.' });
  await exercise.deleteOne();
  return res.json({ deleted: true, id: req.params.id });
}
