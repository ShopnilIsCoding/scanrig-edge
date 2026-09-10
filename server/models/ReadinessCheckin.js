import mongoose from 'mongoose';

const readinessCheckinSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dateKey: { type: String, required: true },
  energy: { type: Number, min: 1, max: 5, required: true },
  sleep: { type: Number, min: 1, max: 5, required: true },
  soreness: { type: Number, min: 1, max: 5, required: true },
  stress: { type: Number, min: 1, max: 5, required: true },
  discomfort: { type: Number, min: 0, max: 5, default: 0 },
  note: { type: String, trim: true, maxlength: 280, default: '' },
  score: { type: Number, min: 0, max: 100, default: 0 },
  band: { type: String, enum: ['ready', 'moderate', 'recovery'], default: 'moderate' },
}, { timestamps: true });

readinessCheckinSchema.index({ user: 1, dateKey: 1 }, { unique: true });

export default mongoose.model('ReadinessCheckin', readinessCheckinSchema);
