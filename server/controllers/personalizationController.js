import User from '../models/User.js';
import { buildUserPlan } from '../services/personalizationService.js';
import { addGeminiCoachNote } from '../services/geminiCoach.js';

export async function getPersonalizedPlan(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const plan = await buildUserPlan(user, {
      dateKey: req.query.dateKey,
      todayName: req.query.todayName,
    });
    const enhanced = req.query.insight === 'gemini' ? await addGeminiCoachNote(plan, user) : await addGeminiCoachNote(plan, user, { localOnly: true });
    return res.json({ plan: enhanced });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not build personalized plan' });
  }
}
