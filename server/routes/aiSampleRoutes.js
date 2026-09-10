import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { createSample, deleteSample, exportSamples, getSummary, listSamples, updateSample } from '../controllers/aiSampleController.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/summary', getSummary);
router.get('/export', exportSamples);
router.get('/', listSamples);
router.post('/', createSample);
router.patch('/:id', updateSample);
router.delete('/:id', deleteSample);
export default router;
