import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { createExercise, deleteExercise, listAdminExercises, listPublicExercises, updateExercise } from '../controllers/exerciseController.js';

const router = Router();
router.get('/public', listPublicExercises);
router.get('/admin', requireAuth, requireAdmin, listAdminExercises);
router.post('/admin', requireAuth, requireAdmin, createExercise);
router.patch('/admin/:id', requireAuth, requireAdmin, updateExercise);
router.delete('/admin/:id', requireAuth, requireAdmin, deleteExercise);
export default router;
