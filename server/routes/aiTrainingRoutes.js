import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { startTraining, trainingStatus } from '../controllers/aiTrainingController.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/status', trainingStatus);
router.post('/start', startTraining);
export default router;
