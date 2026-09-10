import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getReadinessHistory, getTodayReadiness, saveTodayReadiness } from '../controllers/readinessController.js';

const router = Router();
router.get('/today', requireAuth, getTodayReadiness);
router.post('/today', requireAuth, saveTodayReadiness);
router.get('/history', requireAuth, getReadinessHistory);
export default router;
