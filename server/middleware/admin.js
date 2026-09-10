import User from '../models/User.js';

export async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('role email');
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Administrator access required' });
    }
    req.adminUser = user;
    return next();
  } catch (error) {
    console.error('[ScanRig API] admin authorization failed:', error);
    return res.status(500).json({ message: 'Could not verify administrator access' });
  }
}
