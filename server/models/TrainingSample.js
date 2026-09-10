import mongoose from 'mongoose';

const trainingSampleSchema = new mongoose.Schema({
  recordingId: { type: String, required: true, unique: true, index: true },
  sessionId: { type: String, default: '' },
  label: { type: String, required: true, index: true, lowercase: true, trim: true },
  participantName: { type: String, default: 'Admin trainer', trim: true, index: true },
  participantGender: { type: String, enum: ['male', 'female', 'other'], default: 'male', index: true },
  trainerPersona: { type: String, enum: ['james', 'jody'], default: 'james' },
  // Kept for compatibility with older Stage 18 exports.
  participantId: { type: String, default: '', trim: true },
  cameraView: { type: String, default: 'front' },
  notes: { type: String, default: '' },
  capturedAt: { type: Date, default: Date.now, index: true },
  sequenceLength: { type: Number, default: 48 },
  featureCount: { type: Number, default: 132 },
  sampleHz: { type: Number, default: 12 },
  frames: { type: [[Number]], required: true },
  status: { type: String, enum: ['approved', 'review', 'rejected'], default: 'approved', index: true },
  source: { type: String, enum: ['admin-real', 'imported-real'], default: 'admin-real' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

trainingSampleSchema.index({ label: 1, status: 1, capturedAt: -1 });
trainingSampleSchema.index({ participantName: 1, participantGender: 1 });

export default mongoose.model('TrainingSample', trainingSampleSchema);
