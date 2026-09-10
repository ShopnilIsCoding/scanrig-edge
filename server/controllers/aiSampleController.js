import TrainingSample from '../models/TrainingSample.js';
import ExerciseDefinition from '../models/ExerciseDefinition.js';
import { CORE_LABELS } from '../config/coreExercises.js';

function validateFrames(frames) {
  if (!Array.isArray(frames) || frames.length < 18 || frames.length > 120) return false;
  return frames.every((frame) => (
    Array.isArray(frame)
    && frame.length === 132
    && frame.every((value) => Number.isFinite(Number(value)))
  ));
}

async function availableLabels() {
  const custom = await ExerciseDefinition.find().select('id').lean();
  return [...CORE_LABELS, ...custom.map((item) => item.id), 'unknown'];
}

async function labelSupported(label) {
  if (CORE_LABELS.includes(label) || label === 'unknown') return true;
  return Boolean(await ExerciseDefinition.exists({ id: label }));
}

function metadata(sample) {
  return {
    id: sample._id,
    recordingId: sample.recordingId,
    label: sample.label,
    participantName: sample.participantName || sample.participantId || 'Unknown trainer',
    participantGender: sample.participantGender || 'other',
    trainerPersona: sample.trainerPersona || 'james',
    participantId: sample.participantId || '',
    cameraView: sample.cameraView,
    notes: sample.notes,
    capturedAt: sample.capturedAt,
    sequenceLength: sample.sequenceLength,
    featureCount: sample.featureCount,
    sampleHz: sample.sampleHz,
    status: sample.status,
    source: sample.source,
    createdAt: sample.createdAt,
  };
}

export async function createSample(req, res) {
  try {
    const payload = req.body || {};
    if (!await labelSupported(payload.label)) return res.status(400).json({ message: 'Unsupported training label. Create the exercise first if this is a new movement.' });
    if (!validateFrames(payload.frames)) return res.status(400).json({ message: 'Training sample must contain stable 132-feature pose frames' });

    const participantName = String(payload.participantName || payload.participantId || 'Admin trainer').trim().slice(0, 80);
    const participantGender = ['male', 'female', 'other'].includes(payload.participantGender) ? payload.participantGender : 'other';
    const trainerPersona = payload.trainerPersona === 'jody' ? 'jody' : 'james';

    const sample = await TrainingSample.create({
      recordingId: payload.recordingId || `${payload.label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: payload.sessionId || '',
      label: payload.label,
      participantName,
      participantGender,
      trainerPersona,
      participantId: participantName,
      cameraView: String(payload.cameraView || 'front').slice(0, 40),
      notes: String(payload.notes || '').slice(0, 500),
      capturedAt: payload.capturedAt || new Date(),
      sequenceLength: Number(payload.sequenceLength || payload.frames.length),
      featureCount: Number(payload.featureCount || 132),
      sampleHz: Number(payload.sampleHz || 12),
      frames: payload.frames,
      status: payload.status === 'review' ? 'review' : 'approved',
      source: 'admin-real',
      createdBy: req.userId,
    });
    return res.status(201).json({ sample: metadata(sample) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'That recording is already in the dataset' });
    console.error(error);
    return res.status(500).json({ message: 'Could not save training sample' });
  }
}

export async function getSummary(_req, res) {
  try {
    const labels = await availableLabels();
    const [total, grouped, byStatus, byGender] = await Promise.all([
      TrainingSample.countDocuments(),
      TrainingSample.aggregate([{ $group: { _id: '$label', count: { $sum: 1 } } }]),
      TrainingSample.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      TrainingSample.aggregate([{ $group: { _id: '$participantGender', count: { $sum: 1 } } }]),
    ]);
    const counts = Object.fromEntries(labels.map((label) => [label, 0]));
    grouped.forEach((item) => { counts[item._id] = item.count; });
    const statuses = { approved: 0, review: 0, rejected: 0 };
    byStatus.forEach((item) => { statuses[item._id] = item.count; });
    const genders = { male: 0, female: 0, other: 0 };
    byGender.forEach((item) => { if (item._id) genders[item._id] = item.count; });
    return res.json({ total, counts, statuses, genders, labels });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load dataset summary' });
  }
}

export async function listSamples(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const query = {};
    if (req.query.label && await labelSupported(req.query.label)) query.label = req.query.label;
    if (['approved', 'review', 'rejected'].includes(req.query.status)) query.status = req.query.status;
    if (req.query.gender && ['male', 'female', 'other'].includes(req.query.gender)) query.participantGender = req.query.gender;
    if (req.query.participantName) query.participantName = new RegExp(String(req.query.participantName).slice(0, 60), 'i');
    const [items, total] = await Promise.all([
      TrainingSample.find(query).select('-frames').sort({ capturedAt: -1 }).skip((page - 1) * limit).limit(limit),
      TrainingSample.countDocuments(query),
    ]);
    return res.json({ samples: items.map(metadata), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load training samples' });
  }
}

export async function updateSample(req, res) {
  try {
    const updates = {};
    if (req.body.label !== undefined) {
      if (!await labelSupported(req.body.label)) return res.status(400).json({ message: 'Unsupported training label' });
      updates.label = req.body.label;
    }
    if (req.body.status !== undefined) {
      if (!['approved', 'review', 'rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Unsupported sample status' });
      updates.status = req.body.status;
    }
    if (req.body.notes !== undefined) updates.notes = String(req.body.notes || '').slice(0, 500);
    if (req.body.participantName !== undefined) updates.participantName = String(req.body.participantName || '').trim().slice(0, 80);
    if (req.body.participantGender !== undefined && ['male', 'female', 'other'].includes(req.body.participantGender)) updates.participantGender = req.body.participantGender;
    if (req.body.trainerPersona !== undefined && ['james', 'jody'].includes(req.body.trainerPersona)) updates.trainerPersona = req.body.trainerPersona;
    const sample = await TrainingSample.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true }).select('-frames');
    if (!sample) return res.status(404).json({ message: 'Training sample not found' });
    return res.json({ sample: metadata(sample) });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'Could not update training sample' });
  }
}

export async function deleteSample(req, res) {
  const sample = await TrainingSample.findByIdAndDelete(req.params.id);
  if (!sample) return res.status(404).json({ message: 'Training sample not found' });
  return res.json({ deleted: true, id: req.params.id });
}

export async function exportSamples(req, res) {
  try {
    const includeRejected = req.query.includeRejected === 'true';
    const query = includeRejected ? {} : { status: { $ne: 'rejected' } };
    const items = await TrainingSample.find(query).sort({ capturedAt: 1 }).lean();
    const labels = await availableLabels();
    const recordings = items.map((item) => ({
      schemaVersion: 2,
      recordingId: item.recordingId,
      sessionId: item.sessionId,
      label: item.label,
      participantName: item.participantName || item.participantId || 'Unknown trainer',
      participantGender: item.participantGender || 'other',
      trainerPersona: item.trainerPersona || 'james',
      participantId: item.participantName || item.participantId || 'Unknown trainer',
      cameraView: item.cameraView,
      notes: item.notes,
      capturedAt: item.capturedAt,
      sequenceLength: item.sequenceLength,
      featureCount: item.featureCount,
      sampleHz: item.sampleHz,
      frames: item.frames,
      source: item.source,
      status: item.status,
    }));
    return res.json({ schemaVersion: 2, createdAt: new Date().toISOString(), labels, recordings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not export training dataset' });
  }
}
