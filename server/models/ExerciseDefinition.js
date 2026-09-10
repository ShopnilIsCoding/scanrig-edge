import mongoose from 'mongoose';

const exerciseDefinitionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, default: 'Custom', trim: true },
  difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  target: { type: String, default: '', trim: true },
  equipment: { type: String, default: 'No equipment', trim: true },
  duration: { type: String, default: '3 sets × 10 reps', trim: true },
  description: { type: String, default: '', trim: true },
  youtubeUrl: { type: String, default: '', trim: true },
  instructions: [{ type: String, trim: true }],
  commonMistakes: [{ type: String, trim: true }],
  primaryMuscles: [{ type: String, trim: true }],
  secondaryMuscles: [{ type: String, trim: true }],
  accent: { type: String, enum: ['cyan', 'orange', 'lime', 'violet'], default: 'cyan' },
  icon: { type: String, default: '◆' },
  trackingMode: { type: String, enum: ['reps', 'hold', 'classifier-only'], default: 'classifier-only' },
  trackerTemplate: {
    type: String,
    enum: ['classifier-only', 'push-up', 'squat', 'lunge', 'jumping-jack', 'shoulder-press', 'biceps-curl', 'high-knees', 'crunch', 'plank'],
    default: 'classifier-only',
  },
  baseTarget: { type: Number, default: 10, min: 1, max: 300 },
  sets: { type: Number, default: 3, min: 1, max: 10 },
  status: { type: String, enum: ['draft', 'beta', 'published'], default: 'draft', index: true },
  sampleGoal: { type: Number, default: 25, min: 5, max: 1000 },
  syntheticAvailable: { type: Boolean, default: false },
  trainedAt: { type: Date, default: null },
  trainedSampleCount: { type: Number, default: 0, min: 0 },
  trainedModelVersion: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

exerciseDefinitionSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('ExerciseDefinition', exerciseDefinitionSchema);
