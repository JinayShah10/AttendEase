import express from 'express';
import { getSubjects, getClasses, getOpenElectives, getProgramElectives } from '../controllers/masterController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/subjects', protect, getSubjects);
router.get('/classes', getClasses);
router.get('/oe-subjects', protect, getOpenElectives);
router.get('/pe-subjects', protect, getProgramElectives);

export default router;
