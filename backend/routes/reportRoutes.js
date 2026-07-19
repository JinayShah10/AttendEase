import express from 'express';
import { generateReport, getConsolidated, getOESummary } from '../controllers/reportController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/generate/:uploadId', protect, generateReport);
router.get('/consolidated', adminOnly, getConsolidated);
router.get('/oe-summary', protect, getOESummary);

export default router;
