import { Router } from 'express';
import { createWorkout, listWorkouts, workoutSummary } from '../controllers/workoutController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/summary', workoutSummary);
router.post('/', createWorkout);
router.get('/', listWorkouts);
export default router;
