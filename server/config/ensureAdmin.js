import bcrypt from 'bcryptjs';
import User from '../models/User.js';

export async function ensureAdminAccount() {
  const email = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = process.env.ADMIN_NAME || 'ScanRig Admin';

  // A public deployment should not silently create a known default administrator.
  if (!email || !password) {
    console.log('[ScanRig API] admin account creation skipped (ADMIN_EMAIL/ADMIN_PASSWORD not configured)');
    return;
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  }

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
      profile: { onboardingComplete: true, gender: 'male' },
    });
    console.log(`[ScanRig API] admin account created for ${email}`);
    return;
  }

  let changed = false;
  if (user.role !== 'admin') {
    user.role = 'admin';
    changed = true;
  }
  if (!user.profile?.onboardingComplete) {
    user.profile = { ...(user.profile?.toObject?.() || user.profile || {}), onboardingComplete: true };
    changed = true;
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    user.passwordHash = await bcrypt.hash(password, 12);
    changed = true;
  }
  if (changed) await user.save();
}
