import mongoose from 'mongoose';

const exerciseReportSchema = new mongoose.Schema({
  id: { type: String, default: '' },
  name: { type: String, default: '' },
  reps: { type: Number, min: 0, default: 0 },
  average: { type: Number, min: 0, max: 100, default: 0 },
  best: { type: Number, min: 0, max: 100, default: 0 },
  adjust: { type: Number, min: 0, default: 0 },
  topCue: { type: String, default: '' },
}, { _id: false });

const formReportSchema = new mongoose.Schema({
  grade: { type: String, default: '' },
  consistency: { type: Number, min: 0, max: 100, default: 0 },
  strongReps: { type: Number, min: 0, default: 0 },
  goodReps: { type: Number, min: 0, default: 0 },
  adjustReps: { type: Number, min: 0, default: 0 },
  strongest: { id: String, name: String, average: Number },
  focus: { id: String, name: String, average: Number },
  focusTip: { type: String, default: '' },
  fatigueMessage: { type: String, default: '' },
  fatigueEvents: { type: Number, min: 0, default: 0 },
  coachSummary: { type: String, default: '' },
  exerciseBreakdown: { type: [exerciseReportSchema], default: [] },
}, { _id: false });

const workoutSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reps: { type: Number, default: 0 },
  formScore: { type: Number, min: 0, max: 100, default: 0 },
  repQualityAverage: { type: Number, min: 0, max: 100, default: 0 },
  fatigueScore: { type: Number, min: 0, max: 100, default: 0 },
  fatigueEvents: { type: Number, min: 0, default: 0 },
  readinessScore: { type: Number, min: 0, max: 100, default: 0 },
  readinessBand: { type: String, enum: ['', 'ready', 'moderate', 'recovery'], default: '' },
  planVersion: { type: String, default: '' },
  durationSeconds: { type: Number, default: 0 },
  caloriesBurned: { type: Number, min: 0, default: 0 },
  calorieTarget: { type: Number, min: 0, default: 0 },
  exerciseCalories: { type: Map, of: Number, default: {} },
  exercises: [{ type: String }],
  formReport: { type: formReportSchema, default: null },
  xp: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('WorkoutSession', workoutSessionSchema);
