import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role || 'user', profile: user.profile };
}

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ message: 'Name, email and a 6+ character password are required' });
    }
    const normalEmail = email.toLowerCase();
    const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();
    if (normalEmail === adminEmail) return res.status(403).json({ message: 'This email is reserved for the ScanRig administrator' });
    const existing = await User.findOne({ email: normalEmail });
    if (existing) return res.status(409).json({ message: 'An account already exists for this email' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not create account' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ message: 'Incorrect email or password' });
    }
    return res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not log in' });
  }
}

export async function getMe(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'Account not found' });
  return res.json({ user: publicUser(user) });
}

export async function updateProfile(req, res) {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.profile) updates.profile = req.body.profile;
    const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'Account not found' });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'Could not update profile' });
  }
}
