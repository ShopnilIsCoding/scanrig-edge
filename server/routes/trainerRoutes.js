import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { chatWithTrainer, getTrainerContext } from '../controllers/trainerController.js';

const router = Router();
router.get('/context', requireAuth, getTrainerContext);
router.post('/chat', requireAuth, chatWithTrainer);
export default router;
