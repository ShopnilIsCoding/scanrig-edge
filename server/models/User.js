import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  gender: { type: String, enum: ['male', 'female'], default: 'male' },
  dateOfBirth: String,
  age: Number,
  height: Number,
  weight: Number,
  goal: String,
  level: String,
  days: [String],
  sessionLength: Number,
  equipment: [String],
  onboardingComplete: { type: Boolean, default: false },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  profile: { type: profileSchema, default: () => ({}) },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
