import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPersonalizedPlan } from '../controllers/personalizationController.js';

const router = Router();
router.get('/plan', requireAuth, getPersonalizedPlan);
export default router;
